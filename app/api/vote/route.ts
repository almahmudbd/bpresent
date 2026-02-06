import { NextResponse } from "next/server";
import { polls } from "@/lib/store";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { code, optionId, text } = body;

        if (!code) {
            return NextResponse.json({ error: "Missing code" }, { status: 400 });
        }

        const poll = polls[code];

        if (!poll) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        if (poll.type === "word-cloud") {
            if (!text) return NextResponse.json({ error: "Missing text for word cloud" }, { status: 400 });

            const normalizedText = text.trim().toLowerCase();
            const existingOption = poll.options.find(o => o.text.toLowerCase() === normalizedText);

            if (existingOption) {
                existingOption.votes += 1;
            } else {
                poll.options.push({
                    id: crypto.randomUUID(),
                    text: text.trim(), // Keep original casing for display
                    votes: 1,
                    color: "#" + Math.floor(Math.random() * 16777215).toString(16) // Random color
                });
            }
        } else {
            // Quiz mode
            if (!optionId) return NextResponse.json({ error: "Missing optionId" }, { status: 400 });

            const option = poll.options.find((o) => o.id === optionId);
            if (!option) {
                return NextResponse.json({ error: "Option not found" }, { status: 404 });
            }
            option.votes += 1;
        }

        // Trigger Pusher event
        const activeSlide = poll.slides[poll.activeSlideIndex];
        const responseData = {
            ...poll,
            ...activeSlide,
            activeQuestionId: activeSlide.id
        };

        await pusherServer.trigger(`poll-${code}`, "poll-update", responseData);

        return NextResponse.json({ success: true, poll });
    } catch (error) {
        console.error("Error voting:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
