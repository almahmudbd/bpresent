import { redis } from "@/lib/redis";
import { supabase } from "@/lib/supabaseClient";
import { type VoteInput, type VoteResults, type OptionResult } from "@/lib/types";

/**
 * Track a participant joining a poll slide
 */
export async function trackParticipant(
    code: string,
    slideId: string,
    sessionId: string
): Promise<void> {
    const key = `poll:${code}:slide:${slideId}:participants`;
    await redis.sadd(key, sessionId);

    // Set TTL to match poll TTL
    const pollTTL = parseInt(process.env.POLL_TTL_HOURS || "24") * 3600;
    await redis.expire(key, pollTTL);
}

/**
 * Get participant count for a slide
 */
export async function getParticipantCount(
    code: string,
    slideId: string
): Promise<number> {
    const key = `poll:${code}:slide:${slideId}:participants`;
    const count = await redis.scard(key);
    return count || 0;
}

/**
 * Check if a session has already voted on a slide
 */
async function hasVoted(
    code: string,
    slideId: string,
    sessionId: string
): Promise<boolean> {
    const key = `poll:${code}:slide:${slideId}:voters`;
    const isMember = await redis.sismember(key, sessionId);
    return isMember === 1;
}

/**
 * Mark a session as having voted
 */
async function markAsVoted(
    code: string,
    slideId: string,
    sessionId: string
): Promise<void> {
    const key = `poll:${code}:slide:${slideId}:voters`;
    await redis.sadd(key, sessionId);

    const pollTTL = parseInt(process.env.POLL_TTL_HOURS || "24") * 3600;
    await redis.expire(key, pollTTL);
}

/**
 * Submit a vote for a quiz option
 */
export async function submitVote(input: VoteInput): Promise<void> {
    if (!input.option_id) {
        throw new Error("Option ID is required for quiz votes");
    }

    // Get slide info to check if already voted
    const { data: optionData } = await supabase
        .from("options")
        .select("slide_id")
        .eq("id", input.option_id)
        .single();

    if (!optionData) {
        throw new Error("Option not found");
    }

    // Check if already voted
    const alreadyVoted = await hasVoted(input.code, optionData.slide_id, input.session_id);
    if (alreadyVoted) {
        throw new Error("Already voted on this slide");
    }

    // Increment vote count atomically using RPC
    const { error } = await supabase.rpc("vote_for_option", {
        option_id: input.option_id,
    });

    if (error) {
        throw new Error(`Failed to submit vote: ${error.message}`);
    }

    // Mark as voted
    await markAsVoted(input.code, optionData.slide_id, input.session_id);

    // Track participant
    await trackParticipant(input.code, optionData.slide_id, input.session_id);
}

/**
 * Submit a word cloud vote
 */
export async function submitWordCloudVote(input: VoteInput): Promise<void> {
    if (!input.text) {
        throw new Error("Text is required for word cloud votes");
    }

    // Get poll and slide info
    const { data: pollData } = await supabase
        .from("polls")
        .select("id, active_slide_id")
        .eq("code", input.code)
        .single();

    if (!pollData) {
        throw new Error("Poll not found");
    }

    const slideId = pollData.active_slide_id;

    // Check if already voted
    const alreadyVoted = await hasVoted(input.code, slideId, input.session_id);
    if (alreadyVoted) {
        throw new Error("Already voted on this slide");
    }

    const normalizedText = input.text.trim().toLowerCase();

    // Check if option already exists
    const { data: existingOptions } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    const existingOption = existingOptions?.find(
        (o) => o.text.toLowerCase() === normalizedText
    );

    if (existingOption) {
        // Increment existing option
        await supabase.rpc("vote_for_option", {
            option_id: existingOption.id,
        });
    } else {
        // Create new option
        const { error } = await supabase.from("options").insert({
            slide_id: slideId,
            text: input.text.trim(),
            vote_count: 1,
            color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        });

        if (error) {
            throw new Error(`Failed to create option: ${error.message}`);
        }
    }

    // Mark as voted
    await markAsVoted(input.code, slideId, input.session_id);

    // Track participant
    await trackParticipant(input.code, slideId, input.session_id);
}

/**
 * Get vote results for a slide
 */
export async function getVoteResults(
    code: string,
    slideId: string
): Promise<VoteResults> {
    // Fetch options with vote counts
    const { data: options } = await supabase
        .from("options")
        .select("*")
        .eq("slide_id", slideId);

    if (!options) {
        return {
            slide_id: slideId,
            options: [],
            total_votes: 0,
            participant_count: 0,
        };
    }

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const participantCount = await getParticipantCount(code, slideId);

    const optionResults: OptionResult[] = options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.vote_count,
        color: opt.color,
        percentage: totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0,
    }));

    return {
        slide_id: slideId,
        options: optionResults,
        total_votes: totalVotes,
        participant_count: participantCount,
    };
}

/**
 * Get all slide IDs that a session has voted on
 */
export async function getVotedSlideIds(
    code: string,
    slideIds: string[],
    sessionId: string
): Promise<string[]> {
    const checks = slideIds.map(async (slideId) => {
        const key = `poll:${code}:slide:${slideId}:voters`;
        const isMember = await redis.sismember(key, sessionId);
        return { slideId, isMember: isMember === 1 };
    });

    const results = await Promise.all(checks);

    return results
        .filter(r => r.isMember)
        .map(r => r.slideId);
}
