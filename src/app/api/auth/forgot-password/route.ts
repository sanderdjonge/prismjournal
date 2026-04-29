import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const rateLimitResult = await checkLimit(request, { ...Limiters.register, name: 'forgot-password', limit: 3 });
  if (rateLimitResult) return rateLimitResult;

  try {
    const validation = await validateBody(request, forgotPasswordSchema);
    if (!validation.success) return validation.response;
    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      const resetToken = randomBytes(32).toString('hex');
      const tokenId = resetToken.slice(0, 8);
      const hashedToken = await bcrypt.hash(resetToken, 12);

      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenId,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL;
      if (!baseUrl) {
        logger.error('Password reset failed: NEXTAUTH_URL is not set');
        return badRequest('Email service is not configured. Please contact an administrator.');
      }
      const resetUrl = `${baseUrl}/reset-password`;

      const emailResult = await sendPasswordResetEmail(user.email!, resetToken, resetUrl);
      if (!emailResult.success) {
        logger.error({ error: emailResult.error }, 'Password reset email failed');
      }
    }

    return ok({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Password reset request error');
    return internalError();
  }
}
