import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check admin
    const { data: adminData } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).single();
    if (!adminData) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase service role key not configured" }, { status: 500 });
    }

    try {
        const { action } = await request.json();

        if (action === "cleanup_anonymous") {
            const { data, error } = await supabaseAdmin.rpc("cleanup_expired_anonymous_polls");
            if (error) throw error;
            return NextResponse.json({ message: "Cleaned up anonymous polls", deleted: data });
        }

        if (action === "expire_authenticated") {
            const { data, error } = await supabaseAdmin.rpc("expire_authenticated_polls");
            if (error) throw error;
            return NextResponse.json({ message: "Expired authenticated polls", expired: data });
        }

        if (action === "cleanup_old") {
            const { data, error } = await supabaseAdmin.rpc("cleanup_old_expired_polls");
            if (error) throw error;
            return NextResponse.json({ message: "Cleaned up old polls", deleted: data });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    // Return system status
    return NextResponse.json({
        redis_enabled: process.env.REDIS_ENABLED === 'true' || !!process.env.UPSTASH_REDIS_REST_URL || !!process.env.REDIS_URL,
        node_version: process.version,
        environment: process.env.NODE_ENV
    });
}
