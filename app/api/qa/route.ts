import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
    getQuestions,
    submitQuestion,
    applyPresenterQAAction,
    setQAOpen,
    archiveAllAnswered,
} from "@/lib/services/qa.service";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";

const supabase = supabaseAdmin || anonSupabase;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/qa?pollId=xxx[&includeArchived=true]
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const pollId = searchParams.get("pollId");
        const includeArchived = searchParams.get("includeArchived") === "true";

        if (!pollId) {
            return NextResponse.json({ error: "pollId is required" }, { status: 400 });
        }

        const questions = await getQuestions(pollId, includeArchived);

        // Attach userUpvoted for each question based on session cookie
        const cookieStore = await cookies();
        const sessionId = cookieStore.get("voter_session_id")?.value;

        let upvotedIds: Set<string> = new Set();
        if (sessionId) {
            const { data: upvotes } = await supabase
                .from("question_upvotes")
                .select("question_id")
                .eq("session_id", sessionId)
                .in("question_id", questions.map((q) => q.id));

            upvotedIds = new Set((upvotes || []).map((u) => u.question_id));
        }

        const questionsWithUpvoteState = questions.map((q) => ({
            ...q,
            userUpvoted: upvotedIds.has(q.id),
        }));

        return NextResponse.json({ questions: questionsWithUpvoteState });
    } catch (error) {
        console.error("Error fetching questions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/qa — submit a question (audience)
// ─────────────────────────────────────────────────────────────────────────────

const submitQuestionSchema = z.object({
    poll_id: z.string().uuid("Invalid poll ID"),
    text: z.string().min(1, "Question cannot be empty").max(500, "Question too long"),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { poll_id, text } = submitQuestionSchema.parse(body);

        // Get or create session
        const cookieStore = await cookies();
        let sessionId = cookieStore.get("voter_session_id")?.value;
        if (!sessionId) sessionId = crypto.randomUUID();

        // Check Q&A is enabled and open
        const { data: pollData } = await supabase
            .from("polls")
            .select("qa_enabled, qa_is_open")
            .eq("id", poll_id)
            .single();

        if (!pollData?.qa_enabled) {
            return NextResponse.json({ error: "Q&A is not enabled for this poll" }, { status: 403 });
        }
        if (!pollData.qa_is_open) {
            return NextResponse.json({ error: "Q&A is currently closed" }, { status: 403 });
        }

        const question = await submitQuestion({ poll_id, text, session_id: sessionId });

        const response = NextResponse.json({ question });
        response.cookies.set("voter_session_id", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
        });
        return response;
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        console.error("Error submitting question:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/qa — presenter actions (highlight, answer, archive, reply, toggle)
// ─────────────────────────────────────────────────────────────────────────────

const presenterActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("highlight"),   question_id: z.string().uuid() }),
    z.object({ action: z.literal("unhighlight"), question_id: z.string().uuid() }),
    z.object({ action: z.literal("answer"),      question_id: z.string().uuid() }),
    z.object({ action: z.literal("archive"),     question_id: z.string().uuid() }),
    z.object({ action: z.literal("unarchive"),   question_id: z.string().uuid() }),
    z.object({ action: z.literal("reply"),       question_id: z.string().uuid(), reply_text: z.string().max(1000) }),
    z.object({ action: z.literal("toggle_qa"),   poll_id: z.string().uuid(), qa_is_open: z.boolean() }),
    z.object({ action: z.literal("archive_all_answered"), poll_id: z.string().uuid() }),
]);

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const parsed = presenterActionSchema.parse(body);

        if (parsed.action === "toggle_qa") {
            await setQAOpen(parsed.poll_id, parsed.qa_is_open);
            return NextResponse.json({ success: true });
        }

        if (parsed.action === "archive_all_answered") {
            await archiveAllAnswered(parsed.poll_id);
            return NextResponse.json({ success: true });
        }

        await applyPresenterQAAction(parsed as any);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        console.error("Error applying Q&A action:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
