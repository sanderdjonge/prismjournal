import { describe, it, expect } from 'vitest';
import { ok, created, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api/responses';

describe('API response helpers', () => {
  it('ok returns 200 with JSON body', async () => {
    const res = ok({ id: '1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: '1' });
  });

  it('created returns 201', async () => {
    const res = created({ id: '1' });
    expect(res.status).toBe(201);
  });

  it('badRequest returns 400 with error field', async () => {
    const res = badRequest('Invalid input');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid input' });
  });

  it('unauthorized returns 401', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('forbidden returns 403', async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'Forbidden' });
  });

  it('notFound returns 404', async () => {
    const res = notFound('Trade');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Trade not found' });
  });

  it('internalError returns 500', async () => {
    const res = internalError();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
