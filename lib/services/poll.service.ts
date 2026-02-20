import { redis } from "@/lib/redis";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";

const supabase = supabaseAdmin || anonSupabase;
import {
    type Poll,
    type CreatePollInput,
    type RedisPoll,
    type RedisSlide,
    type PollWithSlides,
    type SlideWithOptions,
} from "@/lib/types";

const POLL_TTL_HOURS = parseInt(process.env.POLL_TTL_HOURS || "24");
const POLL_CODE_LENGTH = parseInt(process.env.POLL_CODE_LENGTH || "4");

/**
 * Generate a unique 4-digit poll code
 */
async function generatePollCode(): Promise<string> {
    const min = Math.pow(10, POLL_CODE_LENGTH - 1);
    const max = Math.pow(10, POLL_CODE_LENGTH) - 1;

    for (let attempts = 0; attempts < 10; attempts++) {
        const code = Math.floor(min + Math.random() * (max - min + 1)).toString();

        if (redis.enabled) {
            // Check if code exists in Redis
            const exists = await redis.exists(`poll:${code}`);
            if (!exists) {
                return code;
            }
        } else {
            // Fallback to Supabase check
            const { count } = await supabase
                .from("polls")
                .select("*", { count: 'exact', head: true })
                .eq("code", code);

            if (!count || count === 0) {
                return code;
            }
        }
    }

    throw new Error("Failed to generate unique poll code");
}

/**
 * Create a new poll in both Redis (active) and Supabase (persistent)
 */
export async function createPoll(
    input: CreatePollInput,
    presenterId?: string
): Promise<{ poll: Poll; code: string }> {
    const code = await generatePollCode();

    // Calculate expiration based on authentication
    const isAuthenticated = !!presenterId;
    const expirationHours = isAuthenticated ? 24 : 3; // 24h for logged-in, 3h for anonymous
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // 1. Create poll in Supabase for persistence
    const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .insert({
            code,
            title: input.title || input.slides[0]?.question || "Untitled Poll",
            presenter_id: presenterId,
            user_id: presenterId || null,
            status: 'active',
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

    if (pollError || !pollData) {
        throw new Error(`Failed to create poll: ${pollError?.message}`);
    }

    // 2. Create slides in Supabase
    const slidesToInsert = input.slides.map((slide, index) => ({
        poll_id: pollData.id,
        type: slide.type,
        question: slide.question,
        order_index: index,
        style: slide.style || (slide.type === 'word-cloud' ? 'cloud' : 'donut'),
    }));

    const { data: insertedSlides, error: slidesError } = await supabase
        .from("slides")
        .insert(slidesToInsert)
        .select();

    if (slidesError || !insertedSlides) {
        throw new Error(`Failed to create slides: ${slidesError?.message}`);
    }

    // 3. Create options for quiz slides
    const optionsToInsert: any[] = [];
    const COLORS = [
        "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#db2777",
    ];

    insertedSlides.forEach((dbSlide, index) => {
        const inputSlide = input.slides[index];
        if (inputSlide.type === "quiz" && inputSlide.options) {
            inputSlide.options.forEach((optText, optIndex) => {
                optionsToInsert.push({
                    slide_id: dbSlide.id,
                    text: optText,
                    color: COLORS[optIndex % COLORS.length],
                });
            });
        }
    });

    if (optionsToInsert.length > 0) {
        const { error: optionsError } = await supabase
            .from("options")
            .insert(optionsToInsert);

        if (optionsError) {
            throw new Error(`Failed to create options: ${optionsError.message}`);
        }
    }

    // 4. Set active slide to the first one
    const firstSlideId = insertedSlides[0].id;
    await supabase
        .from("polls")
        .update({ active_slide_id: firstSlideId })
        .eq("id", pollData.id);

    // 5. Store in Redis for fast access (if enabled)
    if (redis.enabled) {
        const redisPoll: RedisPoll = {
            id: pollData.id,
            code,
            title: pollData.title,
            presenter_id: presenterId,
            active_slide_id: firstSlideId,
            created_at: pollData.created_at,
        };

        // Store poll metadata
        await redis.hset(`poll:${code}`, { ...redisPoll });
        await redis.expire(`poll:${code}`, POLL_TTL_HOURS * 3600);

        // Store slides data
        const redisSlides: RedisSlide[] = insertedSlides.map((slide) => ({
            id: slide.id,
            poll_id: slide.poll_id,
            type: slide.type,
            question: slide.question,
            order_index: slide.order_index,
            options: [], // Will be populated when fetching
        }));

        await redis.set(`poll:${code}:slides`, JSON.stringify(redisSlides));
        await redis.expire(`poll:${code}:slides`, POLL_TTL_HOURS * 3600);
    }

    return {
        poll: { ...pollData, active_slide_id: firstSlideId },
        code,
    };
}

/**
 * Get poll data from Redis (fast) or Supabase (fallback)
 */
export async function getPoll(code: string): Promise<PollWithSlides | null> {
    // Try Redis first if enabled
    if (redis.enabled) {
        const redisPoll = await redis.hgetall(`poll:${code}`);

        if (redisPoll && Object.keys(redisPoll).length > 0) {
            // Poll exists in Redis, fetch from Supabase for complete data
            const { data: pollData } = await supabase
                .from("polls")
                .select("*")
                .eq("code", code)
                .single();

            if (!pollData) return null;

            // Check for expiration (Lazy Expiry)
            if (pollData.status === 'active' && pollData.expires_at && new Date(pollData.expires_at) < new Date()) {
                await supabase
                    .from("polls")
                    .update({ status: 'expired' })
                    .eq("id", pollData.id);

                await redis.hset(`poll:${code}`, { status: 'expired' });
                pollData.status = 'expired';
            }

            // Fetch slides with options
            const { data: slidesData } = await supabase
                .from("slides")
                .select("*")
                .eq("poll_id", pollData.id)
                .order("order_index", { ascending: true });

            if (!slidesData) return null;

            // Fetch all options
            const slideIds = slidesData.map((s) => s.id);
            const { data: optionsData } = await supabase
                .from("options")
                .select("*")
                .in("slide_id", slideIds);

            const slidesWithOptions: SlideWithOptions[] = slidesData.map((slide) => ({
                ...slide,
                options: optionsData?.filter((o) => o.slide_id === slide.id) || [],
            }));

            return {
                ...pollData,
                slides: slidesWithOptions,
            };
        }
    }

    // Poll not in Redis or Redis disabled, check Supabase
    const { data: pollData } = await supabase
        .from("polls")
        .select("*")
        .eq("code", code)
        .is("archived_at", null)
        .single();

    if (!pollData) return null;

    // Check for expiration (Lazy Expiry)
    if (pollData.status === 'active' && pollData.expires_at && new Date(pollData.expires_at) < new Date()) {
        await supabase
            .from("polls")
            .update({ status: 'expired' })
            .eq("id", pollData.id);

        if (redis.enabled) {
            await redis.hset(`poll:${code}`, { status: 'expired' });
        }
        pollData.status = 'expired';
    }

    // Fetch slides with options
    const { data: slidesData } = await supabase
        .from("slides")
        .select("*")
        .eq("poll_id", pollData.id)
        .order("order_index", { ascending: true });

    if (!slidesData) return null;

    const slideIds = slidesData.map((s) => s.id);
    const { data: optionsData } = await supabase
        .from("options")
        .select("*")
        .in("slide_id", slideIds);

    const slidesWithOptions: SlideWithOptions[] = slidesData.map((slide) => ({
        ...slide,
        options: optionsData?.filter((o) => o.slide_id === slide.id) || [],
    }));

    return {
        ...pollData,
        slides: slidesWithOptions,
    };
}

/**
 * Update the active slide for a poll
 */
export async function updateActiveSlide(
    code: string,
    slideId: string
): Promise<void> {
    // Update in Supabase
    const { data: pollData } = await supabase
        .from("polls")
        .select("id")
        .eq("code", code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    await supabase
        .from("polls")
        .update({ active_slide_id: slideId })
        .eq("id", pollData.id);

    // Update in Redis if enabled
    if (redis.enabled) {
        await redis.hset(`poll:${code}`, { active_slide_id: slideId });
    }
}

/**
 * Update the status of a poll (e.g., 'completed')
 */
export async function updatePollStatus(
    code: string,
    status: 'active' | 'completed' | 'expired'
): Promise<void> {
    const { data: pollData } = await supabase
        .from("polls")
        .select("id")
        .eq("code", code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    const updates: any = { status };
    if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
    }

    // Update in Supabase
    await supabase
        .from("polls")
        .update(updates)
        .eq("id", pollData.id);

    // Update in Redis if enabled
    if (redis.enabled) {
        await redis.hset(`poll:${code}`, { status });
    }
}

/**
 * Archive a poll (move from active to archived)
 */
export async function archivePoll(code: string): Promise<void> {
    const { data: pollData } = await supabase
        .from("polls")
        .select("id")
        .eq("code", code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    // Mark as archived in Supabase
    await supabase
        .from("polls")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", pollData.id);

    // Remove from Redis if enabled
    if (redis.enabled) {
        await redis.del(`poll:${code}`);
        await redis.del(`poll:${code}:slides`);
    }
}

/**
 * Delete a poll completely
 */
export async function deletePoll(code: string): Promise<void> {
    const { data: pollData } = await supabase
        .from("polls")
        .select("id")
        .eq("code", code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    // Delete from Supabase (cascades to slides, options, votes)
    await supabase.from("polls").delete().eq("id", pollData.id);

    // Remove from Redis if enabled
    if (redis.enabled) {
        await redis.del(`poll:${code}`);
        await redis.del(`poll:${code}:slides`);
    }
}

/**
 * Add a new slide to an existing poll
 */
import { CreateSlideInput } from "@/lib/types";

export async function addSlideToPoll(
    code: string,
    slideInput: CreateSlideInput
): Promise<SlideWithOptions> {
    // 1. Get poll data to verify it exists and get ID
    const { data: pollData } = await supabase
        .from("polls")
        .select("id")
        .eq("code", code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    // 2. Get current max order_index
    const { data: maxOrderData } = await supabase
        .from("slides")
        .select("order_index")
        .eq("poll_id", pollData.id)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();

    const nextOrderIndex = (maxOrderData?.order_index ?? -1) + 1;

    // 3. Insert new slide
    const { data: insertedSlide, error: slideError } = await supabase
        .from("slides")
        .insert({
            poll_id: pollData.id,
            type: slideInput.type,
            question: slideInput.question,
            order_index: nextOrderIndex,
            style: slideInput.style || (slideInput.type === 'word-cloud' ? 'cloud' : 'donut'),
        })
        .select()
        .single();

    if (slideError || !insertedSlide) {
        throw new Error(`Failed to create slide: ${slideError?.message}`);
    }

    // 4. Insert options if quiz
    const optionsToInsert: any[] = [];
    const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#db2777"];

    if (slideInput.type === "quiz" && slideInput.options) {
        slideInput.options.forEach((optText, optIndex) => {
            optionsToInsert.push({
                slide_id: insertedSlide.id,
                text: optText,
                color: COLORS[optIndex % COLORS.length],
            });
        });
    }

    let insertedOptions: any[] = [];
    if (optionsToInsert.length > 0) {
        const { data: opts, error: optionsError } = await supabase
            .from("options")
            .insert(optionsToInsert)
            .select();

        if (optionsError) {
            throw new Error(`Failed to create options: ${optionsError.message}`);
        }
        insertedOptions = opts || [];
    }

    const slideWithOptions: SlideWithOptions = {
        ...insertedSlide,
        options: insertedOptions,
    };

    // 5. Update Redis if enabled
    if (redis.enabled) {
        await redis.del(`poll:${code}:slides`);
    }

    return slideWithOptions;
}
