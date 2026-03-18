import { NextRequest, NextResponse } from 'next/server';
import { auth, usedTotpCodes, cleanupUsedCodes } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
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

        const { password, code } = await request.json();
        
        if (!password || !code) {
            return NextResponse.json({ error: 'Password and code are required' }, { status: 400 });
        }

        // Get user with password and TOTP settings
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { 
                password: true, 
                totpSecret: true, 
                totpEnabled: true 
            }
        });

        if (!user || !user.password) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!user.totpEnabled) {
            return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
        }

        // Verify TOTP code
        if (!user.totpSecret) {
            return NextResponse.json({ error: '2FA secret not found' }, { status: 400 });
        }

        // TOTP replay protection
        cleanupUsedCodes();
        const codeKey = `${session.user.id}:${code}`;
        if (usedTotpCodes.has(codeKey)) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        // Verify using otplib v13 API
        const result = verifySync({ secret: user.totpSecret, token: code });
        if (!result.valid) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        // Mark code as used for 90 seconds
        usedTotpCodes.set(codeKey, Date.now() + 90_000);

        // Disable 2FA
        await prisma.user.update({
            where: { id: session.user.id },
            data: { 
                totpEnabled: false,
                totpSecret: null
            }
        });

        return NextResponse.json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        console.error('2FA disable error:', error);
        return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
    }
}
