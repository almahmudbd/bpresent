import { NextResponse } from "next/server";
import { z } from "zod";
import {
    submitVote,
    submitWordCloudVote,
    submitOpenTextVote,
    submitIdea,
    upvoteIdea,
    submitRatingVote,
    submitRankingVote,
    trackParticipant,
} from "@/lib/services/voting.service";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const quizVoteSchema = z.object({
    code: z.string().length(4),
    option_id: z.string().uuid(),
});

const wordCloudVoteSchema = z.object({
    code: z.string().length(4),
    text: z.string().min(1).max(100),
});

const openTextVoteSchema = z.object({
    code: z.string().length(4),
    slide_id: z.string().uuid(),
    text: z.string().min(1).max(1000),
});

const ideaSubmitSchema = z.object({
    code: z.string().length(4),
    slide_id: z.string().uuid(),
    text: z.string().min(1).max(300),
});

const ideaUpvoteSchema = z.object({
    code: z.string().length(4),
    slide_id: z.string().uuid(),
    idea_option_id: z.string().uuid(),
});

const ratingVoteSchema = z.object({
    code: z.string().length(4),
    slide_id: z.string().uuid(),
    option_id: z.string().uuid().optional(),
    rating_value: z.number().min(1).max(10).optional(),
    rating_items: z.array(z.object({
        option_id: z.string().uuid(),
        rating_value: z.number().min(1).max(10),
    })).optional(),
});

const rankingVoteSchema = z.object({
    code: z.string().length(4),
    slide_id: z.string().uuid(),
    rank_order: z.array(z.string().uuid()).min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get or create session ID
// ─────────────────────────────────────────────────────────────────────────────

async function getSessionId(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get("voter_session_id")?.value || crypto.randomUUID();
}

function setSessionCookie(response: NextResponse, sessionId: string): NextResponse {
    response.cookies.set("voter_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vote — Submit a vote (any type)
// Determined by which fields are present in the body
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const sessionId = await getSessionId();

        // ── 1. Quiz (multiple choice) ──
        if (body.option_id && !body.idea_option_id) {
            const { code, option_id } = quizVoteSchema.parse(body);
            await submitVote({ code, option_id, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 2. Word Cloud ──
        if (body.text && !body.slide_id && !body.idea_option_id) {
            const { code, text } = wordCloudVoteSchema.parse(body);
            await submitWordCloudVote({ code, text, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 3. Open Text ──
        if (body.text && body.slide_id && body.vote_type === "open-text") {
            const { code, slide_id, text } = openTextVoteSchema.parse(body);
            await submitOpenTextVote({ code, slide_id, text, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 4. Ideas — submit new idea ──
        if (body.text && body.slide_id && body.vote_type === "ideas") {
            const { code, slide_id, text } = ideaSubmitSchema.parse(body);
            await submitIdea({ code, slide_id, text, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 5. Ideas — upvote existing idea ──
        if (body.idea_option_id) {
            const { code, slide_id, idea_option_id } = ideaUpvoteSchema.parse(body);
            await upvoteIdea(code, slide_id, idea_option_id, sessionId);
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 6. Rating ──
        if (body.rating_value !== undefined || body.rating_items !== undefined) {
            const { code, slide_id, option_id, rating_value, rating_items } = ratingVoteSchema.parse(body);
            await submitRatingVote({ code, slide_id, option_id, rating_value, rating_items, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        // ── 7. Ranking ──
        if (body.rank_order) {
            const { code, slide_id, rank_order } = rankingVoteSchema.parse(body);
            await submitRankingVote({ code, slide_id, rank_order, session_id: sessionId });
            return setSessionCookie(NextResponse.json({ success: true }), sessionId);
        }

        return NextResponse.json(
            { error: "Invalid vote body — no recognised vote type fields" },
            { status: 400 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        if (error instanceof Error) {
            if (error.message.includes("Already voted") || error.message.includes("Already upvoted")) {
                return NextResponse.json({ error: error.message }, { status: 409 });
            }
            if (error.message.includes("Poll not found")) {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
        }
        console.error("Error submitting vote:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/vote — Track participant (for counting without voting)
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const sessionId = await getSessionId();

        const { code, slideId } = z.object({
            code: z.string().length(4),
            slideId: z.string().uuid(),
        }).parse(body);

        await trackParticipant(code, slideId, sessionId);

        return setSessionCookie(NextResponse.json({ success: true }), sessionId);
    } catch (error) {
        console.error("Error tracking participant:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
