import prisma from '@/lib/prisma';

export async function logAuditEvent(
  action: string,
  userId: string | null,
  details: Record<string, unknown>,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      details: details as object,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    },
  });
}
