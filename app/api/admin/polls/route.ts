import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

/**
 * GET /api/admin/polls
 * List all polls system-wide (admin only)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const db = supabaseAdmin || supabase;

        // Check if user is admin (by user_id or email)
        const { data: adminData } = await db
            .from("admin_users")
            .select("user_id, email")
            .or(`user_id.eq.${user.id},email.eq.${user.email || ""}`)
            .maybeSingle();

        if (!adminData) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        // Get status filter from query params
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        // Build query
        let query = supabaseAdmin
            .from("polls")
            .select(`
                *,
                slides(count)
            `)
            .order("created_at", { ascending: false })
            .limit(100);

        if (status && status !== "all") {
            query = query.eq("status", status);
        }

        const { data: polls, error: pollsError } = await query;

        if (pollsError) {
            return NextResponse.json({ error: pollsError.message }, { status: 500 });
        }

        return NextResponse.json({ polls: polls || [] }, { status: 200 });
    } catch (error) {
        console.error("Error fetching polls:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
