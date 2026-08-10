import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { toggleQuestionUpvote } from "@/lib/services/qa.service";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";

const supabase = supabaseAdmin || anonSupabase;

const upvoteSchema = z.object({
    question_id: z.string().uuid("Invalid question ID"),
});

/**
 * POST /api/qa/upvote — toggle upvote on a question
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { question_id } = upvoteSchema.parse(body);

        const cookieStore = await cookies();
        let sessionId = cookieStore.get("voter_session_id")?.value;
        if (!sessionId) sessionId = crypto.randomUUID();

        // Verify the question's poll has Q&A enabled
        const { data: qData } = await supabase
            .from("questions")
            .select("poll_id, polls!inner(qa_enabled)")
            .eq("id", question_id)
            .single();

        if (!qData) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 });
        }

        const didUpvote = await toggleQuestionUpvote(question_id, sessionId);

        const response = NextResponse.json({ success: true, upvoted: didUpvote });
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
        console.error("Error toggling upvote:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
