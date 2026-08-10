import { NextRequest, NextResponse } from "next/server";
import { supabase as anonSupabase, supabaseAdmin } from "@/lib/supabaseClient";

const supabase = supabaseAdmin || anonSupabase;

/**
 * GET /api/admin/users/[id]
 * Get specific user data (admin only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Verify authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        // Check if user is admin (by user_id or email)
        const { data: adminData } = await supabase
            .from("admin_users")
            .select("user_id, email")
            .or(`user_id.eq.${user.id},email.eq.${user.email || ""}`)
            .maybeSingle();

        if (!adminData) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        // Get user's polls with slides
        const { data: polls } = await supabase
            .from("polls")
            .select("*, slides(*)")
            .eq("user_id", id)
            .order("created_at", { ascending: false });

        // Get user's presentations
        const { data: presentations } = await supabase
            .from("saved_presentations")
            .select("*")
            .eq("user_id", id)
            .order("updated_at", { ascending: false });

        return NextResponse.json({
            polls: polls || [],
            presentations: presentations || [],
        }, { status: 200 });
    } catch (error) {
        console.error("Error fetching user data:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user and all their data (admin only)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Verify authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        // Check if user is admin
        const { data: adminData } = await supabase
            .from("admin_users")
            .select("user_id, email")
            .or(`user_id.eq.${user.id},email.eq.${user.email || ""}`)
            .maybeSingle();

        if (!adminData) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        // Don't allow deleting yourself
        if (id === user.id) {
            return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Supabase service role key not configured" }, { status: 500 });
        }

        // Delete user from auth (cascades to all related data via foreign keys)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
