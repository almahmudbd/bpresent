import { redis } from "@/lib/redis";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";
import { type VoteInput, type VoteResults, type OptionResult, type TextResponse } from "@/lib/types";

const supabase = supabaseAdmin || anonSupabase;

// ─────────────────────────────────────────────────────────────────────────────
// Participant tracking
// ─────────────────────────────────────────────────────────────────────────────

export async function trackParticipant(
    code: string,
    slideId: string,
    sessionId: string
): Promise<void> {
    if (redis.enabled) {
        const key = `poll:${code}:slide:${slideId}:participants`;
        await redis.sadd(key, sessionId);
        const pollTTL = parseInt(process.env.POLL_TTL_HOURS || "24") * 3600;
        await redis.expire(key, pollTTL);
    } else {
        await supabase
            .from("participants")
            .upsert(
                { poll_code: code, slide_id: slideId, session_id: sessionId, last_seen: new Date().toISOString() },
                { onConflict: "poll_code,slide_id,session_id" }
            );
    }
}

export async function getParticipantCount(
    code: string,
    slideId: string
): Promise<number> {
    if (redis.enabled) {
        const key = `poll:${code}:slide:${slideId}:participants`;
        const count = await redis.scard(key);
        return (count as number) || 0;
    } else {
        const { count } = await supabase
            .from("participants")
            .select("*", { count: "exact", head: true })
            .eq("slide_id", slideId);
        return count || 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vote state helpers
// ─────────────────────────────────────────────────────────────────────────────

async function hasVoted(
    code: string,
    slideId: string,
    sessionId: string
): Promise<boolean> {
    if (redis.enabled) {
        const key = `poll:${code}:slide:${slideId}:voters`;
        const isMember = await redis.sismember(key, sessionId);
        return isMember === 1 || isMember === true;
    } else {
        const { count } = await supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("slide_id", slideId)
            .eq("voter_session_id", sessionId);
        return (count || 0) > 0;
    }
}

async function markAsVoted(
    code: string,
    slideId: string,
    sessionId: string
): Promise<void> {
    if (redis.enabled) {
        const key = `poll:${code}:slide:${slideId}:voters`;
        await redis.sadd(key, sessionId);
        const pollTTL = parseInt(process.env.POLL_TTL_HOURS || "24") * 3600;
        await redis.expire(key, pollTTL);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Quiz (multiple choice)
// ─────────────────────────────────────────────────────────────────────────────

export async function submitVote(input: VoteInput): Promise<void> {
    if (!input.option_id) throw new Error("Option ID is required for quiz votes");

    const { data: optionData } = await supabase
        .from("options")
        .select("slide_id")
        .eq("id", input.option_id)
        .single();

    if (!optionData) throw new Error("Option not found");

    const alreadyVoted = await hasVoted(input.code, optionData.slide_id, input.session_id);
    if (alreadyVoted) throw new Error("Already voted on this slide");

    await supabase.rpc("vote_for_option", { option_id: input.option_id });

    await supabase.from("votes").insert({
        slide_id: optionData.slide_id,
        option_id: input.option_id,
        voter_session_id: input.session_id,
    });

    await markAsVoted(input.code, optionData.slide_id, input.session_id);
    await trackParticipant(input.code, optionData.slide_id, input.session_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Word Cloud
// ─────────────────────────────────────────────────────────────────────────────

export async function submitWordCloudVote(input: VoteInput): Promise<void> {
    if (!input.text) throw new Error("Text is required for word cloud votes");

    const { data: pollData } = await supabase
        .from("polls")
        .select("id, active_slide_id")
        .eq("code", input.code)
        .single();

    if (!pollData) throw new Error("Poll not found");

    const slideId = pollData.active_slide_id;
    const alreadyVoted = await hasVoted(input.code, slideId, input.session_id);
    if (alreadyVoted) throw new Error("Already voted on this slide");

    const normalizedText = input.text.trim().toLowerCase();

    const { data: existingOptions } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    const existingOption = existingOptions?.find((o) => o.text.toLowerCase() === normalizedText);

    let optionId: string;

    if (existingOption) {
        optionId = existingOption.id;
        await supabase.rpc("vote_for_option", { option_id: existingOption.id });
    } else {
        const { data: newOption, error } = await supabase
            .from("options")
            .insert({
                slide_id: slideId,
                text: input.text.trim(),
                vote_count: 1,
                color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
            })
            .select()
            .single();

        if (error || !newOption) throw new Error(`Failed to create option: ${error?.message}`);
        optionId = newOption.id;
    }

    await supabase.from("votes").insert({
        slide_id: slideId,
        option_id: optionId,
        voter_session_id: input.session_id,
        word_text: input.text.trim(),
    });

    await markAsVoted(input.code, slideId, input.session_id);
    await trackParticipant(input.code, slideId, input.session_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Open Text — collect free-form text, no option deduplication
// ─────────────────────────────────────────────────────────────────────────────

export async function submitOpenTextVote(input: VoteInput): Promise<void> {
    if (!input.text) throw new Error("Text is required for open text");
    if (!input.slide_id) throw new Error("slide_id is required for open text");

    // Open text allows multiple submissions per session (each response is unique)
    // So we do NOT call hasVoted / markAsVoted

    // Create a new unique "option" per response (open-text uses options table for storage)
    const { data: newOption, error: optErr } = await supabase
        .from("options")
        .insert({
            slide_id: input.slide_id,
            text: input.text.trim(),
            vote_count: 1,
        })
        .select()
        .single();

    if (optErr || !newOption) throw new Error(`Failed to save response: ${optErr?.message}`);

    await supabase.from("votes").insert({
        slide_id: input.slide_id,
        option_id: newOption.id,
        voter_session_id: input.session_id,
    });

    await trackParticipant(input.code, input.slide_id, input.session_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ideas — upvotable submissions
//    - First submission: creates option
//    - Subsequent submissions from same session: upvote existing option
// ─────────────────────────────────────────────────────────────────────────────

export async function submitIdea(input: VoteInput): Promise<void> {
    if (!input.text) throw new Error("Text is required for ideas");
    if (!input.slide_id) throw new Error("slide_id is required for ideas");

    const { data: newOption, error } = await supabase
        .from("options")
        .insert({
            slide_id: input.slide_id,
            text: input.text.trim(),
            vote_count: 1,
            upvote_count: 0,
            color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
        })
        .select()
        .single();

    if (error || !newOption) throw new Error(`Failed to submit idea: ${error?.message}`);

    await supabase.from("votes").insert({
        slide_id: input.slide_id,
        option_id: newOption.id,
        voter_session_id: input.session_id,
    });

    await markAsVoted(input.code, input.slide_id, input.session_id);
    await trackParticipant(input.code, input.slide_id, input.session_id);
}

export async function upvoteIdea(
    code: string,
    slideId: string,
    optionId: string,
    sessionId: string
): Promise<void> {
    // Check if already upvoted this idea
    const { count } = await supabase
        .from("votes")
        .select("*", { count: "exact", head: true })
        .eq("slide_id", slideId)
        .eq("option_id", optionId)
        .eq("voter_session_id", sessionId);

    if ((count || 0) > 0) throw new Error("Already upvoted this idea");

    await supabase.rpc("vote_for_option", { option_id: optionId });

    await supabase.from("votes").insert({
        slide_id: slideId,
        option_id: optionId,
        voter_session_id: sessionId,
    });

    await trackParticipant(code, slideId, sessionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Rating — numeric score (1-5 stars or 1-10 scale)
// ─────────────────────────────────────────────────────────────────────────────

export async function submitRatingVote(input: VoteInput): Promise<void> {
    if (!input.slide_id) throw new Error("slide_id is required for rating");

    const alreadyVoted = await hasVoted(input.code, input.slide_id, input.session_id);
    if (alreadyVoted) throw new Error("Already rated this slide");

    if (input.rating_items && input.rating_items.length > 0) {
        const rows = input.rating_items.map((item) => ({
            slide_id: input.slide_id!,
            option_id: item.option_id,
            rating_value: item.rating_value,
            voter_session_id: input.session_id,
        }));
        const { error } = await supabase.from("votes").insert(rows);
        if (error) throw new Error(`Failed to submit rating items: ${error.message}`);
    } else if (input.rating_value !== undefined) {
        const { error } = await supabase.from("votes").insert({
            slide_id: input.slide_id,
            option_id: input.option_id || null,
            voter_session_id: input.session_id,
            rating_value: input.rating_value,
        });
        if (error) throw new Error(`Failed to submit rating: ${error.message}`);
    } else {
        throw new Error("rating_value or rating_items is required");
    }

    await markAsVoted(input.code, input.slide_id, input.session_id);
    await trackParticipant(input.code, input.slide_id, input.session_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ranking — ordered list of option IDs
// ─────────────────────────────────────────────────────────────────────────────

export async function submitRankingVote(input: VoteInput): Promise<void> {
    if (!input.rank_order || input.rank_order.length === 0) {
        throw new Error("rank_order is required for ranking votes");
    }
    if (!input.slide_id) throw new Error("slide_id is required for ranking");

    const alreadyVoted = await hasVoted(input.code, input.slide_id, input.session_id);
    if (alreadyVoted) throw new Error("Already ranked this slide");

    // Insert one vote row per option with its rank position
    const voteRows = input.rank_order.map((optionId, index) => ({
        slide_id: input.slide_id!,
        option_id: optionId,
        voter_session_id: input.session_id,
        rank_value: index + 1, // 1 = top rank
    }));

    const { error } = await supabase.from("votes").insert(voteRows);
    if (error) throw new Error(`Failed to submit ranking: ${error.message}`);

    await markAsVoted(input.code, input.slide_id, input.session_id);
    await trackParticipant(input.code, input.slide_id, input.session_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get vote results for any slide type
// ─────────────────────────────────────────────────────────────────────────────

export async function getVoteResults(
    code: string,
    slideId: string
): Promise<VoteResults> {
    // Get slide type
    const { data: slideData } = await supabase
        .from("slides")
        .select("type")
        .eq("id", slideId)
        .single();

    const slideType = slideData?.type || "quiz";

    if (slideType === "rating") {
        return await getRatingResults(code, slideId);
    }

    if (slideType === "ranking") {
        return await getRankingResults(code, slideId);
    }

    if (slideType === "open-text") {
        return await getOpenTextResults(code, slideId);
    }

    // Default: options-based (quiz, word-cloud, ideas)
    const { data: options } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    if (!options) {
        return { slide_id: slideId, type: slideType as any, options: [], total_votes: 0, participant_count: 0 };
    }

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const participantCount = await getParticipantCount(code, slideId);

    const optionResults: OptionResult[] = options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.vote_count,
        color: opt.color,
        percentage: totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0,
        upvote_count: opt.upvote_count,
    }));

    return {
        slide_id: slideId,
        type: slideType as any,
        options: optionResults,
        total_votes: totalVotes,
        participant_count: participantCount,
    };
}

async function getRatingResults(code: string, slideId: string): Promise<VoteResults> {
    const { data: options } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    const { data: votes } = await supabase
        .from("votes")
        .select("option_id, rating_value")
        .eq("slide_id", slideId)
        .not("rating_value", "is", null);

    const participantCount = await getParticipantCount(code, slideId);

    if (options && options.length > 0) {
        const optionResults: OptionResult[] = options.map((opt) => {
            const optVotes = (votes || []).filter((v) => v.option_id === opt.id);
            const values = optVotes.map((v) => v.rating_value as number);
            const total = values.length;
            const avg = total > 0 ? values.reduce((a, b) => a + b, 0) / total : 0;
            return {
                id: opt.id,
                text: opt.text,
                votes: total,
                color: opt.color,
                percentage: 0,
                avg_rating: Math.round(avg * 10) / 10,
            };
        });

        const allValues = (votes || []).map((v) => v.rating_value as number);
        const overallAvg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

        return {
            slide_id: slideId,
            type: "rating",
            options: optionResults,
            total_votes: participantCount,
            participant_count: participantCount,
            average_rating: Math.round(overallAvg * 10) / 10,
        };
    }

    const values = (votes || []).map((v) => v.rating_value as number);
    const total = values.length;
    const avg = total > 0 ? values.reduce((a, b) => a + b, 0) / total : 0;

    const distribution: Record<number, number> = {};
    values.forEach((v) => {
        distribution[v] = (distribution[v] || 0) + 1;
    });

    return {
        slide_id: slideId,
        type: "rating",
        options: [],
        total_votes: total,
        participant_count: participantCount,
        average_rating: Math.round(avg * 10) / 10,
        rating_distribution: distribution,
    };
}

async function getRankingResults(code: string, slideId: string): Promise<VoteResults> {
    const { data: options } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    if (!options || options.length === 0) {
        return { slide_id: slideId, type: "ranking", options: [], total_votes: 0, participant_count: 0 };
    }

    const { data: votes } = await supabase
        .from("votes")
        .select("option_id, rank_value")
        .eq("slide_id", slideId)
        .not("rank_value", "is", null);

    const participantCount = await getParticipantCount(code, slideId);

    // Calculate average rank per option
    const rankSums: Record<string, number> = {};
    const rankCounts: Record<string, number> = {};

    (votes || []).forEach((v) => {
        if (!v.option_id) return;
        rankSums[v.option_id] = (rankSums[v.option_id] || 0) + (v.rank_value || 0);
        rankCounts[v.option_id] = (rankCounts[v.option_id] || 0) + 1;
    });

    const optionResults: OptionResult[] = options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: rankCounts[opt.id] || 0,
        color: opt.color,
        percentage: 0,
        avg_rank: rankCounts[opt.id] ? rankSums[opt.id] / rankCounts[opt.id] : 999,
    })).sort((a, b) => (a.avg_rank || 999) - (b.avg_rank || 999));

    return {
        slide_id: slideId,
        type: "ranking",
        options: optionResults,
        total_votes: participantCount,
        participant_count: participantCount,
    };
}

async function getOpenTextResults(code: string, slideId: string): Promise<VoteResults> {
    const { data: options } = await supabase
        .from("options")
        .select("id, text, created_at")
        .eq("slide_id", slideId)
        .order("created_at", { ascending: false });

    const participantCount = await getParticipantCount(code, slideId);

    const textResponses: TextResponse[] = (options || []).map((opt) => ({
        id: opt.id,
        text: opt.text,
        created_at: opt.created_at,
    }));

    return {
        slide_id: slideId,
        type: "open-text",
        options: [],
        total_votes: textResponses.length,
        participant_count: participantCount,
        text_responses: textResponses,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all slide IDs a session has voted on
// ─────────────────────────────────────────────────────────────────────────────

export async function getVotedSlideIds(
    code: string,
    slideIds: string[],
    sessionId: string
): Promise<string[]> {
    if (redis.enabled) {
        const checks = slideIds.map(async (slideId) => {
            const key = `poll:${code}:slide:${slideId}:voters`;
            const isMember = await redis.sismember(key, sessionId);
            return { slideId, isMember: isMember === 1 || isMember === true };
        });
        const results = await Promise.all(checks);
        return results.filter((r) => r.isMember).map((r) => r.slideId);
    } else {
        const { data: votes } = await supabase
            .from("votes")
            .select("slide_id")
            .eq("voter_session_id", sessionId)
            .in("slide_id", slideIds);
        if (!votes) return [];
        return [...new Set(votes.map((v) => v.slide_id))];
    }
}
