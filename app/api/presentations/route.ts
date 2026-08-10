import { NextRequest, NextResponse } from "next/server";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";

const supabase = supabaseAdmin || anonSupabase;

// GET /api/presentations - List all user's presentations & polls
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Fetch explicit saved presentation templates
        const { data: savedPresentations } = await supabase
            .from("saved_presentations")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

        // 2. Fetch created polls with slides & options
        const { data: userPolls } = await supabase
            .from("polls")
            .select("id, title, created_at, code, slides(*, options(*))")
            .or(`user_id.eq.${user.id},presenter_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

        const formattedPolls = (userPolls || []).map((poll: any) => {
            const sortedSlides = (poll.slides || [])
                .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((s: any) => ({
                    type: s.type,
                    question: s.question,
                    options: (s.options || []).map((o: any) => o.text),
                    style: s.style,
                }));

            return {
                id: poll.id,
                title: poll.title || sortedSlides[0]?.question || `Poll ${poll.code}`,
                slides: sortedSlides,
                created_at: poll.created_at,
                updated_at: poll.created_at,
                code: poll.code,
                is_poll: true,
            };
        });

        // 3. Combine both lists (saved templates + created polls)
        const combined = [...(savedPresentations || []), ...formattedPolls];

        // Remove duplicates by ID if a poll was also saved as presentation
        const seenIds = new Set<string>();
        const uniquePresentations = combined.filter((p) => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
        });

        return NextResponse.json({ presentations: uniquePresentations });
    } catch (error) {
        console.error("Error fetching presentations:", error);
        return NextResponse.json({ error: "Failed to fetch presentations" }, { status: 500 });
    }
}

// POST /api/presentations - Save new presentation
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { title, slides } = body;

        if (!title || !slides) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("saved_presentations")
            .insert([{ user_id: user.id, title, slides }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ presentation: data });
    } catch (error) {
        console.error("Error saving presentation:", error);
        return NextResponse.json({ error: "Failed to save presentation" }, { status: 500 });
    }
}
