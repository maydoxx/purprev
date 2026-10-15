import { Elysia } from "elysia";
import { digestToken } from "./crypto";

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory fallback for single-instance deployments
const memoryStore = new Map<string, RateLimitEntry>();

// Redis store for multi-instance, optional
let redis: any = null;
let redisAvailable = false;

async function initRedis() {
    if (!process.env.REDIS_URL) return;
    try {
        // imported lazily so the redis package is not required to run
        // @ts-ignore - redis is optional
        const redisModule = await import("redis");
        redis = redisModule.createClient({ url: process.env.REDIS_URL });
        await redis.connect();
        redisAvailable = true;
        console.log("Rate limiter: Redis connected");
    } catch (err) {
        console.warn("Rate limiter: Redis unavailable, using in-memory store", err);
        redis = null;
        redisAvailable = false;
    }
}

initRedis();

function getClientIp(request: Request, server: any): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const firstIp = forwarded.split(",")[0]?.trim();
        if (firstIp) return firstIp;
    }
    return server?.requestIP?.address || "unknown";
}

function makeKey(prefix: string, identifier: string): string {
    return `ratelimit:${prefix}:${identifier}`;
}

async function checkLimit(
    key: string,
    windowMs: number,
    maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (redisAvailable && redis) {
        // Redis sliding window using sorted set
        const multi = redis.multi();
        multi.zRemRangeByScore(key, 0, windowStart);
        multi.zCard(key);
        multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
        multi.expire(key, Math.ceil(windowMs / 1000));
        const results = await multi.exec();
        const count = (results[1] as number) ?? 0;
        return {
            allowed: count < maxRequests,
            remaining: Math.max(0, maxRequests - count),
            resetAt: now + windowMs
        };
    } else {
        // In-memory fallback
        const entry = memoryStore.get(key);
        if (!entry || entry.resetAt <= now) {
            memoryStore.set(key, { count: 1, resetAt: now + windowMs });
            return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
        }
        entry.count++;
        return {
            allowed: entry.count <= maxRequests,
            remaining: Math.max(0, maxRequests - entry.count),
            resetAt: entry.resetAt
        };
    }
}

export const createRateLimiter = (config: RateLimitConfig) => {
    return new Elysia({ name: `ratelimit-${config.keyPrefix}` })
        .onBeforeHandle(async ({ request, server, set, status }) => {
            const ip = await digestToken(getClientIp(request, server));
            const key = makeKey(config.keyPrefix, ip);

            const result = await checkLimit(key, config.windowMs, config.maxRequests);

            set.headers = {
                ...(set.headers as Record<string, string>),
                "X-RateLimit-Limit": String(config.maxRequests),
                "X-RateLimit-Remaining": String(result.remaining),
                "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
            };

            if (!result.allowed) {
                return status(429, {
                    error: "Too many requests",
                    retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
                });
            }
        });
};

// Pre-configured limiters for common endpoints
export const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: "auth"
});

export const strictAuthLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: "auth-strict"
});

export const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyPrefix: "api"
});

export const purchaseLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: "purchase"
});

export const tradeLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyPrefix: "trade"
});

// Cleanup old memory entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.resetAt <= now) {
            memoryStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes