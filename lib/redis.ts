import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

// Initialize Redis client - supports both Upstash REST and Redis Cloud
let redisClient: UpstashRedis | IORedis;
let isUpstash = false;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Upstash Redis (REST API)
    redisClient = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    isUpstash = true;
} else if (process.env.REDIS_URL) {
    // Redis Cloud or traditional Redis (using ioredis)
    redisClient = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
    });
    isUpstash = false;
} else {
    throw new Error(
        "Redis configuration missing. Please set either UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN or REDIS_URL"
    );
}

// Unified Redis wrapper to handle API differences
export const redis = {
    async ping() {
        return await redisClient.ping();
    },

    async exists(key: string): Promise<number> {
        return await redisClient.exists(key);
    },

    async set(key: string, value: string): Promise<any> {
        return await redisClient.set(key, value);
    },

    async get(key: string): Promise<string | null> {
        return await redisClient.get(key);
    },

    async del(...keys: string[]): Promise<number> {
        return await redisClient.del(...keys);
    },

    async expire(key: string, seconds: number): Promise<number> {
        return await redisClient.expire(key, seconds);
    },

    async hset(key: string, data: Record<string, any>): Promise<any> {
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
        const result = await redisClient.hgetall(key);
        return result as Record<string, string>;
    },

    async sadd(key: string, ...members: string[]): Promise<number> {
        return await redisClient.sadd(key, ...members);
    },

    async scard(key: string): Promise<number> {
        return await redisClient.scard(key);
    },

    async sismember(key: string, member: string): Promise<number> {
        const result = await redisClient.sismember(key, member);
        return typeof result === 'boolean' ? (result ? 1 : 0) : result;
    },
};

// Helper function to check Redis connection
export async function checkRedisConnection(): Promise<boolean> {
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error("Redis connection failed:", error);
        return false;
    }
}
