import { NextRequest, NextResponse } from 'next/server';
import { auth, pendingTotpSecrets, cleanupPendingSecrets } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSecret, generateURI } from 'otplib';
import { authLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    const rateLimitResult = await authLimiter.check(request, 5);
    if (rateLimitResult) return rateLimitResult;

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
    } catch (error) {
        console.error('2FA setup error:', error);
        return NextResponse.json({ error: 'Failed to setup 2FA' }, { status: 500 });
    }
}
