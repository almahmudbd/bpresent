import { NextResponse } from "next/server";
import { z } from "zod";
import {
    submitVote,
    submitWordCloudVote,
    trackParticipant,
} from "@/lib/services/voting.service";
import { cookies } from "next/headers";

// Validation schemas
const quizVoteSchema = z.object({
    code: z.string().length(4, "Code must be 4 digits"),
    option_id: z.string().uuid("Invalid option ID"),
});

const wordCloudVoteSchema = z.object({
    code: z.string().length(4, "Code must be 4 digits"),
    text: z.string().min(1, "Text is required").max(100, "Text too long"),
});

/**
 * Generate or retrieve session ID for voter
 */
async function getSessionId(): Promise<string> {
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("voter_session_id")?.value;

    if (!sessionId) {
        // Generate new session ID
        sessionId = crypto.randomUUID();
    }

    return sessionId;
}

/**
 * POST /api/vote - Submit a vote
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const sessionId = await getSessionId();

        // Determine vote type and validate
        if (body.option_id) {
            // Quiz vote
            const validatedData = quizVoteSchema.parse(body);

            await submitVote({
                code: validatedData.code,
                option_id: validatedData.option_id,
                session_id: sessionId,
            });
        } else if (body.text) {
            // Word cloud vote
            const validatedData = wordCloudVoteSchema.parse(body);

            await submitWordCloudVote({
                code: validatedData.code,
                text: validatedData.text,
                session_id: sessionId,
            });
        } else {
            return NextResponse.json(
                { error: "Either option_id or text is required" },
                { status: 400 }
            );
        }

        // Set session cookie
        const response = NextResponse.json({ success: true });
        response.cookies.set("voter_session_id", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        // Handle specific error messages
        if (error instanceof Error) {
            if (error.message.includes("Already voted")) {
                return NextResponse.json(
                    { error: "You have already voted on this slide" },
                    { status: 409 }
                );
            }
            if (error.message.includes("not found")) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 404 }
                );
            }
        }

        console.error("Error submitting vote:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/vote/track - Track participant (for counting without voting)
 */
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const sessionId = await getSessionId();

        const { code, slideId } = z.object({
            code: z.string().length(4),
            slideId: z.string().uuid(),
        }).parse(body);

        await trackParticipant(code, slideId, sessionId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error tracking participant:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
