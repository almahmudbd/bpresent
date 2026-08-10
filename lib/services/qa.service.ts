import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";
import {
    type Question,
    type SubmitQuestionInput,
    type PresenterQAAction,
} from "@/lib/types";

const supabase = supabaseAdmin || anonSupabase;

// ─────────────────────────────────────────────────────────────────────────────
// Fetch questions for a poll
// ─────────────────────────────────────────────────────────────────────────────

export async function getQuestions(
    pollId: string,
    includeArchived = false
): Promise<Question[]> {
    let query = supabase
        .from("questions")
        .select("*")
        .eq("poll_id", pollId)
        .order("upvote_count", { ascending: false })
        .order("created_at", { ascending: true });

    if (!includeArchived) {
        query = query.eq("is_archived", false);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit a new question (audience side)
// ─────────────────────────────────────────────────────────────────────────────

export async function submitQuestion(
    input: SubmitQuestionInput
): Promise<Question> {
    const { data, error } = await supabase
        .from("questions")
        .insert({
            poll_id: input.poll_id,
            text: input.text.trim(),
            author_session_id: input.session_id,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to submit question: ${error?.message}`);
    }

    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle upvote on a question (audience side)
// Returns: true if upvoted, false if unvoted
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleQuestionUpvote(
    questionId: string,
    sessionId: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc("toggle_question_upvote", {
        p_question_id: questionId,
        p_session_id: sessionId,
    });

    if (error) {
        throw new Error(`Failed to toggle upvote: ${error.message}`);
    }

    return data as boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get upvoted question IDs for a session
// ─────────────────────────────────────────────────────────────────────────────

export async function getUpvotedQuestionIds(
    pollId: string,
    sessionId: string
): Promise<string[]> {
    // Step 1: fetch all question ids this session has upvoted
    const { data: upvotes, error: upvotesError } = await supabase
        .from("question_upvotes")
        .select("question_id")
        .eq("session_id", sessionId);

    if (upvotesError) {
        throw new Error(`Failed to fetch upvoted question ids: ${upvotesError.message}`);
    }

    const questionIds: string[] = (upvotes || []).map(
        (u: { question_id: string }) => u.question_id
    );

    if (questionIds.length === 0) {
        return [];
    }

    // Step 2: narrow to questions belonging to this poll (no embedded join)
    const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("id")
        .in("id", questionIds)
        .eq("poll_id", pollId);

    if (questionsError) {
        throw new Error(`Failed to fetch poll questions: ${questionsError.message}`);
    }

    return (questions || []).map((q: { id: string }) => q.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Presenter actions on questions
// ─────────────────────────────────────────────────────────────────────────────

export async function applyPresenterQAAction(
    action: PresenterQAAction
): Promise<void> {
    const updates: Record<string, unknown> = {};

    switch (action.action) {
        case "answer":
            updates.is_answered = true;
            updates.is_highlighted = false;
            break;
        case "highlight":
            // Unhighlight all other questions first
            await supabase
                .from("questions")
                .update({ is_highlighted: false })
                .neq("id", action.question_id);
            updates.is_highlighted = true;
            break;
        case "unhighlight":
            updates.is_highlighted = false;
            break;
        case "archive":
            updates.is_archived = true;
            updates.is_highlighted = false;
            break;
        case "unarchive":
            updates.is_archived = false;
            break;
        case "reply":
            updates.reply_text = action.reply_text || null;
            break;
    }

    const { error } = await supabase
        .from("questions")
        .update(updates)
        .eq("id", action.question_id);

    if (error) {
        throw new Error(`Failed to apply Q&A action: ${error.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Q&A open/closed (presenter live control)
// ─────────────────────────────────────────────────────────────────────────────

export async function setQAOpen(
    pollId: string,
    isOpen: boolean
): Promise<void> {
    const { error } = await supabase
        .from("polls")
        .update({ qa_is_open: isOpen })
        .eq("id", pollId);

    if (error) {
        throw new Error(`Failed to toggle Q&A: ${error.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Archive all answered questions
// ─────────────────────────────────────────────────────────────────────────────

export async function archiveAllAnswered(pollId: string): Promise<void> {
    const { error } = await supabase
        .from("questions")
        .update({ is_archived: true })
        .eq("poll_id", pollId)
        .eq("is_answered", true);

    if (error) {
        throw new Error(`Failed to archive answered questions: ${error.message}`);
    }
}
