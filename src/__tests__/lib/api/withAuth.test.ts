import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';

const mockAuth = vi.mocked(auth);

function makeRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('withAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const handler = withAuth(async (_req, _ctx, _session) => Response.json({ ok: true }));
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(401);
  });

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValueOnce({ user: {} } as never);
    const handler = withAuth(async (_req, _ctx, _session) => Response.json({ ok: true }));
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(401);
  });

  it('calls handler with session when authenticated', async () => {
    const session = { user: { id: 'user-1', email: 'test@test.com' } };
    mockAuth.mockResolvedValueOnce(session as never);
    const innerHandler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const handler = withAuth(innerHandler);
    const req = makeRequest();
    await handler(req, {});
    expect(innerHandler).toHaveBeenCalledWith(req, {}, session);
  });

  it('passes through 200 from inner handler', async () => {
    const session = { user: { id: 'user-1', email: 'test@test.com' } };
    mockAuth.mockResolvedValueOnce(session as never);
    const handler = withAuth(async () => Response.json({ data: 'hello' }));
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: 'hello' });
  });
});
