import { NextRequest, NextResponse } from 'next/server';
import { pendingTotpSecrets, cleanupPendingSecrets } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { generateSecret, generateURI } from 'otplib';
import { authLimiter } from '@/lib/rate-limit';

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
    const rateLimitResult = await authLimiter.check(request, 5);
    if (rateLimitResult) return rateLimitResult;

    // Generate a new TOTP secret using otplib v13 API
    const secret = generateSecret();

    // Get user for email
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create provisioning URI using otplib v13 API
    const serviceName = 'PrismJournal';
    const accountName = user.email || user.name || 'user';
    const provisioningUri = generateURI({
        issuer: serviceName,
        label: accountName,
        secret: secret
    });

    // Store secret in memory — only written to DB after the user verifies the code
    cleanupPendingSecrets();
    pendingTotpSecrets.set(session.user.id, {
        secret,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    return NextResponse.json({
        secret,
        provisioning_uri: provisioningUri
    });
});
