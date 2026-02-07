// Quick test to check Redis and Supabase connections
const testConnections = async () => {
    console.log("Testing connections...\n");

    // Test Redis
    try {
        const { redis } = await import("./lib/redis.js");
        const pingResult = await redis.ping();
        console.log("✅ Redis connection:", pingResult);
    } catch (error) {
        console.error("❌ Redis connection failed:", error.message);
    }

    // Test Supabase
    try {
        const { supabase } = await import("./lib/supabaseClient.js");
        const { data, error } = await supabase.from("polls").select("count").limit(1);
        if (error) {
            console.error("❌ Supabase connection failed:", error.message);
        } else {
            console.log("✅ Supabase connection: OK");
        }
    } catch (error) {
        console.error("❌ Supabase connection failed:", error.message);
    }
};

testConnections();
