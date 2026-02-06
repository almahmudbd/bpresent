import { NextResponse } from "next/server";
import { polls } from "@/lib/store";

// Helper to generate 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const COLORS = [
    "#2563eb", // blue-600
    "#dc2626", // red-600
    "#16a34a", // green-600
    "#d97706", // amber-600
    "#7c3aed", // violet-600
    "#db2777", // pink-600
];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { question, options, type = "quiz", code, slides } = body;

        let newSlides: any[] = [];

        if (slides && Array.isArray(slides)) {
            // Processing initial slide deck
            newSlides = slides.map((s: any) => ({
                id: crypto.randomUUID(),
                type: s.type || "quiz",
                question: s.question,
                options: (s.type === "quiz" && s.options) ? s.options.map((opt: string, idx: number) => ({
                    id: crypto.randomUUID(),
                    text: opt,
                    votes: 0,
                    color: COLORS[idx % COLORS.length]
                })) : []
            }));
        } else if (question) {
            // Single question creation
            newSlides = [{
                id: crypto.randomUUID(),
                type,
                question,
                options: type === "quiz" ? options.map((opt: string, index: number) => ({
                    id: crypto.randomUUID(),
                    text: opt,
                    votes: 0,
                    color: COLORS[index % COLORS.length]
                })) : []
            }];
        } else {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        let id = code;
        if (!id) {
            id = generateCode();
            while (polls[id]) {
                id = generateCode();
            }
        }

        if (polls[id]) {
            // Append to existing poll
            const poll = polls[id];
            poll.slides.push(...newSlides);
            poll.activeSlideIndex = poll.slides.length - 1; // Auto switch to new slide
        } else {
            // Create new poll
            polls[id] = {
                id,
                slides: newSlides,
                activeSlideIndex: 0,
                createdAt: Date.now(),
            };
        }

        const poll = polls[id];
        const activeSlide = poll.slides[poll.activeSlideIndex];

        const responseData = {
            ...poll,
            ...activeSlide,
            activeQuestionId: activeSlide.id,
        };

        try {
            const { pusherServer } = await import("@/lib/pusher");
            await pusherServer.trigger(`poll-${id}`, "poll-update", responseData);
        } catch (e) {
            console.error("Pusher trigger failed", e);
        }

        return NextResponse.json({ success: true, code: id, poll: responseData });
    } catch (error) {
        console.error("Error creating poll:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { code, index } = body;

        if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

        const poll = polls[code];
        if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

        if (typeof index === "number" && index >= 0 && index < poll.slides.length) {
            poll.activeSlideIndex = index;

            const activeSlide = poll.slides[poll.activeSlideIndex];
            const responseData = {
                ...poll,
                ...activeSlide,
                activeQuestionId: activeSlide.id,
            };

            try {
                const { pusherServer } = await import("@/lib/pusher");
                await pusherServer.trigger(`poll-${code}`, "poll-update", responseData);
            } catch (e) {
                console.error("Pusher trigger", e);
            }
            return NextResponse.json({ success: true, poll: responseData });
        }

        return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: "Error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const poll = polls[code];

    if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const activeSlide = poll.slides[poll.activeSlideIndex];
    const responseData = {
        ...poll,
        ...activeSlide,
        activeQuestionId: activeSlide.id,
    };

    return NextResponse.json(responseData);
}
