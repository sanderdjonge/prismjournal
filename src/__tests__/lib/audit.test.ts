import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { logAuditEvent } from '@/lib/audit';
import prisma from '@/lib/prisma';

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an AuditLog record with action, userId, and details', async () => {
    await logAuditEvent('LOGIN_FAILED', 'user-123', { email: 'a@b.com', reason: 'wrong_password' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'LOGIN_FAILED',
        userId: 'user-123',
        details: { email: 'a@b.com', reason: 'wrong_password' },
        ipAddress: undefined,
        userAgent: undefined,
      },
    });
  });

  it('populates ipAddress and userAgent as top-level columns', async () => {
    await logAuditEvent(
      'RATE_LIMIT_HIT',
      null,
      { endpoint: '/api/trades' },
      { ip: '1.2.3.4', userAgent: 'Mozilla/5.0' }
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'RATE_LIMIT_HIT',
        userId: null,
        details: { endpoint: '/api/trades' },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      },
    });
  });

  it('accepts null userId for unauthenticated events', async () => {
    await logAuditEvent('SESSION_INVALID', null, { path: '/dashboard' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null }),
    });
  });

  it('resolves without throwing even if details is empty', async () => {
    await expect(logAuditEvent('LOGIN_SUCCESS', 'user-456', {})).resolves.toBeUndefined();
  });
});
