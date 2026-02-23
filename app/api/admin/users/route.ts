import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

/**
 * GET /api/admin/users
 * List all users (admin only)
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

        // Get all users from auth.users (admin query)
        const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

        if (usersError) {
            return NextResponse.json({ error: usersError.message }, { status: 500 });
        }

        // Get poll counts for each user
        const userStats = await Promise.all(
            users.users.map(async (u) => {
                // supabaseAdmin is already checked above, but let's be explicit for lint
                const client = supabaseAdmin!;

                const { count: pollCount } = await client
                    .from("polls")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", u.id);

                const { count: presentationCount } = await client
                    .from("saved_presentations")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", u.id);

                return {
                    id: u.id,
                    email: u.email,
                    created_at: u.created_at,
                    last_sign_in_at: u.last_sign_in_at,
                    poll_count: pollCount || 0,
                    presentation_count: presentationCount || 0,
                };
            })
        );

        return NextResponse.json({ users: userStats }, { status: 200 });
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
