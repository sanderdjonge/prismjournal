import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { passwordLimiter } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  // Rate limit: 3 requests per minute
  const rateLimitResult = await passwordLimiter.check(request, 3);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate a secure random token
      const resetToken = randomBytes(32).toString('hex');
      const tokenId = resetToken.slice(0, 8); // First 8 chars for efficient lookup
      const hashedToken = await bcrypt.hash(resetToken, 12);

      // Delete any existing reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Create new reset token (expires in 1 hour)
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenId,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Send reset email
      const baseUrl = process.env.NEXTAUTH_URL;
      if (!baseUrl) throw new Error('NEXTAUTH_URL is not set');
      const resetUrl = `${baseUrl}/reset-password`;

      await sendPasswordResetEmail(user.email!, resetToken, resetUrl);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
