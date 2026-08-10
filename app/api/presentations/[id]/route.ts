import { NextRequest, NextResponse } from "next/server";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";
import type { CreateSlideInput } from "@/lib/types";

const supabase = supabaseAdmin || anonSupabase;

// PUT /api/presentations/[id] - Update existing presentation
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        const { title, slides } = body as { title?: string; slides?: CreateSlideInput[] };

        // Only include fields present in the body — a missing field must NOT
        // overwrite the stored column with null.
        const updates: { title?: string; slides?: CreateSlideInput[] } = {};
        if (title !== undefined) updates.title = title;
        if (slides !== undefined) updates.slides = slides;
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("saved_presentations")
            .update(updates)
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ presentation: data });
    } catch (error) {
        console.error("Error updating presentation:", error);
        return NextResponse.json({ error: "Failed to update presentation" }, { status: 500 });
    }
}

// DELETE /api/presentations/[id] - Delete presentation
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { error } = await supabase
            .from("saved_presentations")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting presentation:", error);
        return NextResponse.json({ error: "Failed to delete presentation" }, { status: 500 });
    }
}
