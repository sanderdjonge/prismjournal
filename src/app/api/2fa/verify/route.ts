import { NextRequest, NextResponse } from 'next/server';
import { usedTotpCodes, cleanupUsedCodes, pendingTotpSecrets, cleanupPendingSecrets } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { verifySync } from 'otplib';
import { authLimiter } from '@/lib/rate-limit';

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
    const rateLimitResult = await authLimiter.check(request, 5);
    if (rateLimitResult) return rateLimitResult;

    const { code } = await request.json();

    if (!code || typeof code !== 'string' || code.length !== 6) {
        return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Get pending secret from in-memory cache (set by /api/2fa/setup)
    cleanupPendingSecrets();
    const pending = pendingTotpSecrets.get(session.user.id);
    if (!pending) {
        return NextResponse.json({ error: 'Setup session expired. Please restart 2FA setup.' }, { status: 400 });
    }

    // Check 2FA is not already enabled
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { totpEnabled: true }
    });

    if (user?.totpEnabled) {
        return NextResponse.json({ error: '2FA already enabled' }, { status: 400 });
    }

    // TOTP replay protection
    cleanupUsedCodes();
    const codeKey = `${session.user.id}:${code}`;
    if (usedTotpCodes.has(codeKey)) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Verify the code using otplib v13 API
    const result = verifySync({ secret: pending.secret, token: code });
    if (!result.valid) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Mark code as used for 90 seconds
    usedTotpCodes.set(codeKey, Date.now() + 90_000);

    // Write the verified secret to the DB and clear the cache
    pendingTotpSecrets.delete(session.user.id);

    await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: true, totpSecret: pending.secret }
    });

    return NextResponse.json({ success: true, message: '2FA enabled successfully' });
});
