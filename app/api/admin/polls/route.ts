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

        // Check if user is admin
        const { data: adminData } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .single();

        if (!adminData) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Supabase service role key not configured" }, { status: 500 });
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
