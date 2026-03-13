import { NextResponse } from 'next/server';

type RateLimitConfig = {
  interval: number; // Time window in ms
  uniqueTokenPerInterval: number; // Max unique tokens per interval
};

type TokenInfo = {
  count: number;
  lastReset: number;
};

type RateLimitResult = {
  check: (request: Request, limit: number) => Promise<NextResponse | null>;
};

/**
 * Creates a rate limiter with in-memory token cache
 * @param config - Configuration object with interval and max unique tokens
 * @returns Object with check method that returns 429 response if limit exceeded
 */
export function rateLimit(config: RateLimitConfig): RateLimitResult {
  const tokenCache = new Map<string, TokenInfo>();

  return {
    check: async (request: Request, limit: number) => {
      // Get IP from various headers (for different proxy setups)
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.headers.get('x-real-ip') ??
        'unknown';

      const now = Date.now();
      const token = tokenCache.get(ip);

      // Reset counter if interval has passed or no entry exists
      if (!token || now - token.lastReset > config.interval) {
        tokenCache.set(ip, { count: 1, lastReset: now });

        // Clean up old entries to prevent memory leaks
        if (tokenCache.size > config.uniqueTokenPerInterval) {
          // Remove oldest entries (first in Map)
          const entriesToDelete = tokenCache.size - config.uniqueTokenPerInterval + 1;
          const keys = Array.from(tokenCache.keys());
          for (let i = 0; i < Math.min(entriesToDelete, keys.length); i++) {
            tokenCache.delete(keys[i]);
          }
        }
        return null;
      }

      // Check if limit exceeded
      if (token.count >= limit) {
        const retryAfter = Math.ceil((config.interval - (now - token.lastReset)) / 1000);
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil((token.lastReset + config.interval) / 1000)),
            },
          }
        );
      }

      // Increment counter
      tokenCache.set(ip, { count: token.count + 1, lastReset: token.lastReset });
      return null;
    },
  };
}

/**
 * Rate limiter for authentication endpoints (login, register)
 * More restrictive: 5 requests per minute
 */
export const authLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Track up to 500 unique IPs
});

/**
 * Rate limiter for login page
 * 10 requests per minute
 */
export const loginLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

/**
 * Rate limiter for general API routes
 * 100 requests per minute
 */
export const apiLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 1000, // Track up to 1000 unique IPs
});

/**
 * Rate limiter for sync endpoint
 * 100 requests per minute (same as general API but tracked separately)
 */
export const syncLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100, // Lower unique token count for sync
});

/**
 * Rate limiter for password reset/change operations
 * Very restrictive: 3 requests per minute
 */
export const passwordLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 200,
});
