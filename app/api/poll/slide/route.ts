import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addSlideToPoll, getPoll } from "@/lib/services/poll.service";
import { supabase } from "@/lib/supabaseClient";

const addSlideSchema = z.object({
    code: z.string().length(4, "Code must be 4 digits"),
    type: z.enum(["quiz", "word-cloud"]),
    question: z.string().min(1, "Question is required"),
    options: z.array(z.string()).optional(),
    style: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = addSlideSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid data", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { code, type, question, options, style } = validation.data;

        // Check ownership if user is logged in
        let userId: string | undefined;
        const authHeader = request.headers.get("authorization");

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                userId = user.id;
            }
        }

        const poll = await getPoll(code);
        if (!poll) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        if (poll.presenter_id) {
            if (!userId || userId !== poll.presenter_id) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
        }

        const newSlide = await addSlideToPoll(code, {
            type,
            question,
            options,
            style
        });

        return NextResponse.json(newSlide);

    } catch (error: any) {
        console.error("Failed to add slide:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
