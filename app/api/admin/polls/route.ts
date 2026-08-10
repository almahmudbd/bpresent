import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

/**
 * POST /api/admin/polls
 * Admin actions on polls, e.g. { action: "archive", code: "1234" }
 */
export async function POST(request: NextRequest) {
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

        // Admin endpoints require the service role key. Check before running the
        // admin check so a mis-configured env fails fast.
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Supabase service role key not configured" }, { status: 500 });
        }

        // Check if user is admin (by user_id or email)
        const { data: adminData } = await supabaseAdmin
            .from("admin_users")
            .select("user_id, email")
            .or(`user_id.eq.${user.id},email.eq.${user.email || ""}`)
            .maybeSingle();

        if (!adminData) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        if (body.action !== "archive") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const { code } = body;
        if (typeof code !== "string" || code.trim() === "") {
            return NextResponse.json({ error: "Missing poll code" }, { status: 400 });
        }

        // Look up the poll by its code
        const { data: poll, error: pollError } = await supabaseAdmin
            .from("polls")
            .select("id")
            .eq("code", code.trim())
            .maybeSingle();

        if (pollError) {
            return NextResponse.json({ error: pollError.message }, { status: 500 });
        }

        if (!poll) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        // Archive the poll: soft-delete via archived_at and flip status to expired
        const { error: updateError } = await supabaseAdmin
            .from("polls")
            .update({ archived_at: new Date().toISOString(), status: "expired" })
            .eq("id", poll.id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error archiving poll:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

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

        // Admin endpoints require the service role key. Check before running the
        // admin check so a mis-configured env fails fast.
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Supabase service role key not configured" }, { status: 500 });
        }

        // Check if user is admin (by user_id or email)
        const { data: adminData } = await supabaseAdmin
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
