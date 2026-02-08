import { supabase } from "./supabaseClient";

/**
 * Check if the current user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", userId)
            .single();

        if (error) return false;
        return !!data;
    } catch {
        return false;
    }
}

/**
 * Get current user and check if admin
 */
export async function getCurrentUserWithAdmin() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return { user: null, isAdmin: false };
    }

    const admin = await isAdmin(session.user.id);

    return {
        user: session.user,
        isAdmin: admin,
    };
}

/**
 * Grant admin access to a user by email
 * Can only be called by existing admins
 */
export async function grantAdminAccess(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc("grant_admin_access", {
            user_email: email,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Mark poll as completed
 */
export async function completePoll(pollId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await supabase.rpc("complete_poll", {
            poll_id_param: pollId,
            user_id_param: userId,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: data === true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
