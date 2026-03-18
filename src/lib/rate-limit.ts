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
 * Extract the client IP from a request.
 *
 * Security note: X-Forwarded-For can be spoofed by clients when there is no
 * trusted reverse proxy in front of the application. When a trusted proxy is
 * present it appends the real client IP as the LAST entry in the chain, so we
 * use that value. If the header is absent we fall back to X-Real-IP.
 */
function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Use the last IP in the chain — set by the trusted reverse proxy
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[ips.length - 1] || 'unknown';
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Creates a rate limiter with in-memory token cache
 * @param config - Configuration object with interval and max unique tokens
 * @returns Object with check method that returns 429 response if limit exceeded
 */
export function rateLimit(config: RateLimitConfig): RateLimitResult {
  const tokenCache = new Map<string, TokenInfo>();

  return {
    check: async (request: Request, limit: number) => {
      const ip = extractClientIp(request);

      const now = Date.now();
      const token = tokenCache.get(ip);

      // Reset counter if interval has passed or no entry exists
      if (!token || now - token.lastReset > config.interval) {
        tokenCache.set(ip, { count: 1, lastReset: now });

        // Clean up old entries to prevent memory leaks.
        // NOTE: The sort-based eviction below is O(n log n) on every new/expired
        // entry. This is acceptable given that uniqueTokenPerInterval is bounded
        // (≤1000), but if the cap were much larger a linked-list LRU or a
        // periodic sweep would be preferable.
        if (tokenCache.size > config.uniqueTokenPerInterval) {
          const entriesToDelete = tokenCache.size - config.uniqueTokenPerInterval + 1;
          const sortedEntries = Array.from(tokenCache.entries()).sort(
            ([, a], [, b]) => a.lastReset - b.lastReset
          );
          for (let i = 0; i < Math.min(entriesToDelete, sortedEntries.length); i++) {
            tokenCache.delete(sortedEntries[i][0]);
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
 * 600 requests per minute — MT5 EA sends bursts of history on startup
 */
export const syncLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

/**
 * Rate limiter for password reset/change operations
 * Very restrictive: 3 requests per minute
 */
export const passwordLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 200,
});
