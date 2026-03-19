import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock next-auth so NextAuth() returns a valid object during module evaluation
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock prisma to avoid DB connection
vi.mock('@/lib/prisma', () => ({
  default: {},
}));

import { pendingTotpSecrets, cleanupPendingSecrets } from '@/lib/auth';

describe('pendingTotpSecrets', () => {
  afterEach(() => {
    pendingTotpSecrets.clear();
  });

  it('stores a pending secret with TTL', () => {
    const expiresAt = Date.now() + 10 * 60 * 1000;
    pendingTotpSecrets.set('user-1', { secret: 'JBSWY3DPEHPK3PXP', expiresAt });
    expect(pendingTotpSecrets.get('user-1')?.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('cleanupPendingSecrets removes expired entries', () => {
    vi.useFakeTimers();
    pendingTotpSecrets.set('user-expired', { secret: 'ABC', expiresAt: Date.now() - 1 });
    pendingTotpSecrets.set('user-valid', { secret: 'XYZ', expiresAt: Date.now() + 60_000 });

    cleanupPendingSecrets();

    expect(pendingTotpSecrets.has('user-expired')).toBe(false);
    expect(pendingTotpSecrets.has('user-valid')).toBe(true);
    vi.useRealTimers();
  });

  it('overwriting a pending entry replaces the secret', () => {
    pendingTotpSecrets.set('user-1', { secret: 'OLD', expiresAt: Date.now() + 60_000 });
    pendingTotpSecrets.set('user-1', { secret: 'NEW', expiresAt: Date.now() + 60_000 });
    expect(pendingTotpSecrets.get('user-1')?.secret).toBe('NEW');
  });
});
