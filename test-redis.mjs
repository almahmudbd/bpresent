import Redis from "ioredis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables manually since we're running this script directly
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

async function testRedis() {
    console.log("Testing Redis connection with ioredis...\n");

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.error("❌ REDIS_URL not found in .env");
        return;
    }

    console.log("Connecting to Redis...");

    const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        // Add retry strategy to fail faster
        retryStrategy: (times) => {
            if (times > 3) {
                return null;
            }
            return Math.min(times * 50, 2000);
        }
    });

    try {
        // Test ping
        const pingResult = await redis.ping();
        console.log("✅ Redis PING:", pingResult);

        // Test set/get
        await redis.set("test:key", "Hello Redis!");
        const value = await redis.get("test:key");
        console.log("✅ Redis SET/GET:", value);

        // Cleanup
        await redis.del("test:key");

        console.log("\n🎉 Redis connection is working!");
    } catch (error) {
        console.error("❌ Redis test failed:", error.message);
    } finally {
        redis.disconnect();
    }
}

testRedis();
