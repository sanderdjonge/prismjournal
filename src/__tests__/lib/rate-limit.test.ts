import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, authLimiter, loginLimiter, apiLimiter, syncLimiter } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

// Mock Request with headers
function createMockRequest(ip: string): Request {
  return {
    headers: {
      get: vi.fn((key: string) => {
        if (key === 'x-forwarded-for') return ip;
        if (key === 'x-real-ip') return null;
        return null;
      }),
    },
  } as unknown as Request;
}

function createMockRequestWithRealIp(ip: string): Request {
  return {
    headers: {
      get: vi.fn((key: string) => {
        if (key === 'x-forwarded-for') return null;
        if (key === 'x-real-ip') return ip;
        return null;
      }),
    },
  } as unknown as Request;
}

function createMockRequestNoIp(): Request {
  return {
    headers: {
      get: vi.fn(() => null),
    },
  } as unknown as Request;
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should allow requests under the limit', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Should allow 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await limiter.check(req, 5);
        expect(result).toBeNull();
      }
    });

    it('should block requests over the limit', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Allow 3 requests
      for (let i = 0; i < 3; i++) {
        const result = await limiter.check(req, 3);
        expect(result).toBeNull();
      }

      // 4th request should be blocked
      const result = await limiter.check(req, 3);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should return 429 with correct error message', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Exhaust the limit
      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(429);

      const body = await result?.json();
      expect(body.error).toBe('Too many requests');
      expect(body.retryAfter).toBeDefined();
    });

    it('should include Retry-After header', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Exhaust the limit
      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);

      expect(result?.headers.get('Retry-After')).not.toBeNull();
    });

    it('should include rate limit headers', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Exhaust the limit
      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(result?.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('IP detection', () => {
    it('should use x-forwarded-for header for IP', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');

      // Each IP should have its own limit
      await limiter.check(req1, 1);
      const result1 = await limiter.check(req1, 1);
      expect(result1?.status).toBe(429);

      // Different IP should still be allowed
      const result2 = await limiter.check(req2, 1);
      expect(result2).toBeNull();
    });

    it('should handle x-forwarded-for with multiple IPs (use first)', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = {
        headers: {
          get: vi.fn((key: string) => {
            if (key === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1, 172.16.0.1';
            return null;
          }),
        },
      } as unknown as Request;

      // Should use first IP
      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);
      expect(result?.status).toBe(429);
    });

    it('should fall back to x-real-ip header', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequestWithRealIp('192.168.1.3');

      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);
      expect(result?.status).toBe(429);
    });

    it('should use "unknown" when no IP headers present', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequestNoIp();

      await limiter.check(req, 1);
      const result = await limiter.check(req, 1);
      expect(result?.status).toBe(429);
    });
  });

  describe('time window', () => {
    it('should reset counter after interval', async () => {
      const limiter = rateLimit({
        interval: 60000, // 1 minute
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Exhaust the limit
      await limiter.check(req, 1);
      let result = await limiter.check(req, 1);
      expect(result?.status).toBe(429);

      // Advance time past the interval
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      result = await limiter.check(req, 1);
      expect(result).toBeNull();
    });

    it('should calculate correct retryAfter time', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 100,
      });

      const req = createMockRequest('192.168.1.1');

      // Make request at time 0
      await limiter.check(req, 1);

      // Try again at time 30000 (30 seconds later)
      vi.advanceTimersByTime(30000);
      const result = await limiter.check(req, 1);

      // Should have ~30 seconds remaining
      const body = await result?.json();
      expect(body.retryAfter).toBeGreaterThanOrEqual(29);
      expect(body.retryAfter).toBeLessThanOrEqual(31);
    });
  });

  describe('memory management', () => {
    it('should clean up old entries when limit exceeded', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 5, // Very low limit for testing
      });

      // Create requests from different IPs
      for (let i = 0; i < 10; i++) {
        const req = createMockRequest(`192.168.1.${i}`);
        await limiter.check(req, 1);
      }

      // The cache should have cleaned up old entries
      // This is hard to test directly, but we can verify the limiter still works
      const req = createMockRequest('192.168.1.100');
      const result = await limiter.check(req, 1);
      expect(result).toBeNull();
    });
  });
});

describe('pre-configured limiters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('authLimiter should allow 5 requests per minute', async () => {
    // Use unique IP to avoid interference from other tests
    const req = createMockRequest('10.0.0.1');

    for (let i = 0; i < 5; i++) {
      const result = await authLimiter.check(req, 5);
      expect(result).toBeNull();
    }

    const result = await authLimiter.check(req, 5);
    expect(result?.status).toBe(429);
  });

  it('loginLimiter should allow 10 requests per minute', async () => {
    // Use unique IP to avoid interference from other tests
    const req = createMockRequest('10.0.0.2');

    for (let i = 0; i < 10; i++) {
      const result = await loginLimiter.check(req, 10);
      expect(result).toBeNull();
    }

    const result = await loginLimiter.check(req, 10);
    expect(result?.status).toBe(429);
  });

  it('apiLimiter should allow 100 requests per minute', async () => {
    // Use unique IP to avoid interference from other tests
    const req = createMockRequest('10.0.0.3');

    for (let i = 0; i < 100; i++) {
      const result = await apiLimiter.check(req, 100);
      expect(result).toBeNull();
    }

    const result = await apiLimiter.check(req, 100);
    expect(result?.status).toBe(429);
  });

  it('syncLimiter should allow 100 requests per minute', async () => {
    // Use unique IP to avoid interference from other tests
    const req = createMockRequest('10.0.0.4');

    for (let i = 0; i < 100; i++) {
      const result = await syncLimiter.check(req, 100);
      expect(result).toBeNull();
    }

    const result = await syncLimiter.check(req, 100);
    expect(result?.status).toBe(429);
  });

  it('different limiters should track IPs independently', async () => {
    // Use unique IPs for each limiter to test independence
    const authReq = createMockRequest('10.0.0.5');
    const apiReq = createMockRequest('10.0.0.6');

    // Exhaust authLimiter
    for (let i = 0; i < 5; i++) {
      await authLimiter.check(authReq, 5);
    }
    const authResult = await authLimiter.check(authReq, 5);
    expect(authResult?.status).toBe(429);

    // apiLimiter should still work (different tracker and different IP)
    const apiResult = await apiLimiter.check(apiReq, 100);
    expect(apiResult).toBeNull();
  });
});
