import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET /api/presentations - List all user's presentations
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data, error } = await supabase
            .from("saved_presentations")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ presentations: data });
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
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

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
