/**
 * Redis-backed rate limiter (Node.js only — not for Edge/middleware).
 *
 * Uses INCR + EXPIRE for atomic fixed-window counting in Redis.
 * Falls back to an in-process Map when Redis is unavailable or REDIS_URL is unset,
 * so the app stays functional if Redis is down (fail-open).
 */

import { NextResponse } from 'next/server';

// ── Redis singleton ────────────────────────────────────────────────────────────

let _redis: import('ioredis').Redis | null = null;
let _redisOk = true; // flips false on error; retried after 30 s

async function getRedis(): Promise<import('ioredis').Redis | null> {
  if (!process.env.REDIS_URL) return null;
  if (!_redisOk) return null;

  if (!_redis) {
    const { default: Redis } = await import('ioredis');
    _redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    _redis.on('error', () => {
      _redisOk = false;
      _redis = null;
      // Retry after 30 seconds
      setTimeout(() => { _redisOk = true; }, 30_000);
    });
  }

  return _redis;
}

// ── In-memory fallback ─────────────────────────────────────────────────────────

const memStore = new Map<string, { count: number; resetAt: number }>();

// Periodic sweep to prevent unbounded growth (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (now >= entry.resetAt) memStore.delete(key);
  }
}, 5 * 60_000).unref();

// ── IP extraction ──────────────────────────────────────────────────────────────

function extractIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(s => s.trim());
    return ips[ips.length - 1] || 'unknown';
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

// ── Core check ─────────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  name: string;     // used as part of the Redis key, e.g. 'api', 'sync'
  limit: number;    // max requests per window
  windowMs: number; // window size in ms
}

/**
 * Returns a 429 NextResponse if the IP has exceeded the limit, otherwise null.
 * Fails open (returns null) if Redis is unavailable.
 */
export async function checkLimit(
  req: Request,
  config: RateLimiterConfig,
): Promise<NextResponse | null> {
  const ip = extractIp(req);
  const key = `rl:${config.name}:${ip}`;
  const windowSec = Math.ceil(config.windowMs / 1000);

  try {
    const redis = await getRedis();

    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);

      if (count > config.limit) {
        const ttl = Math.max(await redis.ttl(key), 1);
        return tooManyRequests(config.limit, ttl);
      }
      return null;
    }
  } catch {
    // Fall through to in-memory on Redis error
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (entry.count >= config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return tooManyRequests(config.limit, retryAfter);
  }

  entry.count++;
  return null;
}

function tooManyRequests(limit: number, retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

// ── Pre-configured limiters ────────────────────────────────────────────────────

export const Limiters = {
  register: { name: 'register', limit: 5,   windowMs: 60_000 } as RateLimiterConfig,
  sync:     { name: 'sync',     limit: parseInt(process.env.RATE_LIMIT_SYNC ?? '600'), windowMs: 60_000 } as RateLimiterConfig,
  api:      { name: 'api',      limit: parseInt(process.env.RATE_LIMIT_API  ?? '100'), windowMs: 60_000 } as RateLimiterConfig,
  admin:    { name: 'admin',    limit: 30,  windowMs: 60_000 } as RateLimiterConfig,
};
