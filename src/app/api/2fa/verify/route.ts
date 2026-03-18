import { NextRequest, NextResponse } from 'next/server';
import { auth, usedTotpCodes, cleanupUsedCodes } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { verifySync } from 'otplib';
import { authLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    const rateLimitResult = await authLimiter.check(request, 5);
    if (rateLimitResult) return rateLimitResult;

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await request.json();
        
        if (!code || typeof code !== 'string' || code.length !== 6) {
            return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
        }

        // Get user with TOTP secret
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { totpSecret: true, totpEnabled: true }
        });

        if (!user || !user.totpSecret) {
            return NextResponse.json({ error: '2FA not set up' }, { status: 400 });
        }

        if (user.totpEnabled) {
            return NextResponse.json({ error: '2FA already enabled' }, { status: 400 });
        }

        // TOTP replay protection
        cleanupUsedCodes();
        const codeKey = `${session.user.id}:${code}`;
        if (usedTotpCodes.has(codeKey)) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        // Verify the code using otplib v13 API
        const result = verifySync({ secret: user.totpSecret, token: code });
        if (!result.valid) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        // Mark code as used for 90 seconds
        usedTotpCodes.set(codeKey, Date.now() + 90_000);

        // Enable 2FA
        await prisma.user.update({
            where: { id: session.user.id },
            data: { totpEnabled: true }
        });

        return NextResponse.json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
        console.error('2FA verify error:', error);
        return NextResponse.json({ error: 'Failed to verify 2FA' }, { status: 500 });
    }
}
