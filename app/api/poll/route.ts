import { NextResponse } from "next/server";
import { z } from "zod";
createPoll,
    getPoll,
    updateActiveSlide,
    deletePoll,
} from "@/lib/services/poll.service";
import { getVotedSlideIds } from "@/lib/services/voting.service";
import { cookies } from "next/headers";

// Validation schemas
const createSlideSchema = z.object({
    type: z.enum(["quiz", "word-cloud"]),
    question: z.string().min(1, "Question is required"),
    options: z.array(z.string()).optional(),
});

const createPollSchema = z.object({
    title: z.string().optional(),
    slides: z.array(createSlideSchema).min(1, "At least one slide is required"),
});

const updateSlideSchema = z.object({
    code: z.string().length(4, "Code must be 4 digits"),
    slideId: z.string().uuid("Invalid slide ID"),
});

/**
 * POST /api/poll - Create a new poll
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Validate input
        const validatedData = createPollSchema.parse(body);

        // Create poll (presenter_id is optional for now)
        const { poll, code } = await createPoll(validatedData);

        return NextResponse.json({
            success: true,
            code,
            poll,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        console.error("Error creating poll:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/poll?code=1234 - Get poll data
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.json(
                { error: "Code parameter is required" },
                { status: 400 }
            );
        }

        if (code.length !== 4) {
            return NextResponse.json(
                { error: "Code must be 4 digits" },
                { status: 400 }
            );
        }

        const poll = await getPoll(code);

        if (!poll) {
            return NextResponse.json(
                { error: "Poll not found" },
                { status: 404 }
            );
        }

        // Check for voter session to determine voted slides
        const cookieStore = await cookies();
        const sessionId = cookieStore.get("voter_session_id")?.value;
        let userVotedSlideIds: string[] = [];

        if (sessionId) {
            const slideIds = poll.slides.map((s) => s.id);
            userVotedSlideIds = await getVotedSlideIds(code, slideIds, sessionId);
        }

        return NextResponse.json({ ...poll, userVotedSlideIds });
    } catch (error) {
        console.error("Error fetching poll:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/poll - Update active slide
 */
export async function PUT(req: Request) {
    try {
        const body = await req.json();

        // Validate input
        const { code, slideId } = updateSlideSchema.parse(body);

        await updateActiveSlide(code, slideId);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        console.error("Error updating poll:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/poll?code=1234 - Delete a poll
 */
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");

        if (!code || code.length !== 4) {
            return NextResponse.json(
                { error: "Valid 4-digit code is required" },
                { status: 400 }
            );
        }

        await deletePoll(code);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting poll:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
