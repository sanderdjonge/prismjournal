import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { passwordLimiter } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * POST /api/auth/reset-password
 * Reset password using token from email
 * Body: { token: string, password: string }
 */
export async function POST(request: NextRequest) {
  // Rate limit: 3 requests per minute
  const rateLimitResult = await passwordLimiter.check(request, 3);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Use tokenId (first 8 chars) for efficient lookup
    const tokenId = token.slice(0, 8);
    const now = new Date();

    // Find token by tokenId first (efficient index lookup)
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
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Verify the full token matches (bcrypt comparison)
    const isValid = await bcrypt.compare(token, resetToken.token);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and mark token as used
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

    // Delete all other reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        id: { not: resetToken.id },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
