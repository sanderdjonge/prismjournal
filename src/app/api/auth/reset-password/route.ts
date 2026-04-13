import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { passwordLimiter } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: NextRequest) {
  const rateLimitResult = await passwordLimiter.check(request, 3);
  if (rateLimitResult) return rateLimitResult;

  try {
    const validation = await validateBody(request, resetPasswordSchema);
    if (!validation.success) return validation.response;
    const { token, password } = validation.data;

    const tokenId = token.slice(0, 8);
    const now = new Date();

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenId,
        expiresAt: { gt: now },
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      return badRequest('Invalid or expired reset token');
    }

    const isValid = await bcrypt.compare(token, resetToken.token);
    if (!isValid) {
      return badRequest('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
    ]);

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        id: { not: resetToken.id },
      },
    });

    return ok({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Password reset error');
    return internalError();
  }
}
