import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function logAuditEvent(
  action: string,
  userId: string | null,
  details: Prisma.InputJsonValue,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    },
  });
}
