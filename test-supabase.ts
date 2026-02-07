// Test script to verify Supabase setup
import { supabase } from "./lib/supabaseClient";

async function testSupabaseSetup() {
    console.log("🔍 Testing Supabase connection...\n");

    try {
        // Test 1: Check connection
        const { data: connectionTest, error: connectionError } = await supabase
            .from("polls")
            .select("count")
            .limit(1);

        if (connectionError) {
            console.error("❌ Connection failed:", connectionError.message);
            return false;
        }
        console.log("✅ Connection successful");

        // Test 2: Check tables exist
        const tables = ["polls", "slides", "options", "votes"];
        for (const table of tables) {
            const { error } = await supabase.from(table).select("*").limit(1);
            if (error) {
                console.error(`❌ Table '${table}' not found or error:`, error.message);
                return false;
            }
            console.log(`✅ Table '${table}' exists`);
        }

        // Test 3: Check RPC functions
        const { error: rpcError } = await supabase.rpc("vote_for_option", {
            option_id: "00000000-0000-0000-0000-000000000000", // Dummy ID
        });

        // We expect an error since the ID doesn't exist, but the function should exist
        if (rpcError && !rpcError.message.includes("violates foreign key")) {
            console.error("❌ RPC function 'vote_for_option' not found:", rpcError.message);
            return false;
        }
        console.log("✅ RPC function 'vote_for_option' exists");

        console.log("\n🎉 All Supabase checks passed!");
        return true;
    } catch (error) {
        console.error("❌ Unexpected error:", error);
        return false;
    }
}

testSupabaseSetup();
