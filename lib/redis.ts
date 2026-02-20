import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

// Initialize Redis client - supports both Upstash REST and Redis Cloud
let redisClient: UpstashRedis | IORedis | null = null;
let isUpstash = false;
let redisEnabled = false;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        // Upstash Redis (REST API)
        redisClient = new UpstashRedis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        isUpstash = true;
        redisEnabled = true;
    } catch (error) {
        console.error("Failed to initialize Upstash Redis:", error);
        redisEnabled = false;
    }
} else if (process.env.REDIS_URL) {
    try {
        // Redis Cloud or traditional Redis (using ioredis)
        redisClient = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true, // Set to true to avoid immediate connection errors
        });
        isUpstash = false;
        redisEnabled = true;
    } catch (error) {
        console.error("Failed to initialize IORedis:", error);
        redisEnabled = false;
    }
} else {
    console.warn("Redis configuration missing. App will fall back to Supabase.");
    redisEnabled = false;
}

// Unified Redis wrapper to handle API differences
export const redis = {
    enabled: redisEnabled,

    async ping() {
        if (!redisEnabled || !redisClient) return "PONG (Mock)";
        return await redisClient.ping();
    },

    async exists(key: string): Promise<number> {
        if (!redisEnabled || !redisClient) return 0;
        return await redisClient.exists(key);
    },

    async set(key: string, value: string): Promise<any> {
        if (!redisEnabled || !redisClient) return "OK";
        return await redisClient.set(key, value);
    },

    async get(key: string): Promise<string | null> {
        if (!redisEnabled || !redisClient) return null;
        return await redisClient.get(key);
    },

    async del(...keys: string[]): Promise<number> {
        if (!redisEnabled || !redisClient) return 0;
        return await redisClient.del(...keys);
    },

    async expire(key: string, seconds: number): Promise<number> {
        if (!redisEnabled || !redisClient) return 0;
        return await redisClient.expire(key, seconds);
    },

    async hset(key: string, data: Record<string, any>): Promise<any> {
        if (!redisEnabled || !redisClient) return "OK";
        if (isUpstash) {
            // Upstash accepts object directly
            return await (redisClient as UpstashRedis).hset(key, data);
        } else {
            // ioredis needs flattened key-value pairs
            const flatData: any[] = [];
            for (const [k, v] of Object.entries(data)) {
                flatData.push(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
            return await (redisClient as IORedis).hset(key, ...flatData);
        }
    },

    async hgetall(key: string): Promise<Record<string, string>> {
        if (!redisEnabled || !redisClient) return {};
        const result = await redisClient.hgetall(key);
        return result as Record<string, string>;
    },

    async sadd(key: string, ...members: string[]): Promise<number> {
        if (!redisEnabled || !redisClient) return 0;
        if (isUpstash) {
            // Upstash accepts variable arguments
            return await (redisClient as UpstashRedis).sadd(key, members[0], ...members.slice(1));
        } else {
            // IORedis accepts variable arguments
            return await (redisClient as IORedis).sadd(key, ...members);
        }
    },

    async scard(key: string): Promise<number> {
        if (!redisEnabled || !redisClient) return 0;
        return await redisClient.scard(key);
    },

    async sismember(key: string, member: string): Promise<number | boolean> {
        if (!redisEnabled || !redisClient) return 0;
        const result = await redisClient.sismember(key, member);
        return result;
    },
};

// Helper function to check Redis connection
export async function checkRedisConnection(): Promise<boolean> {
    if (!redisEnabled) return false;
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error("Redis connection failed:", error);
        return false;
    }
}
