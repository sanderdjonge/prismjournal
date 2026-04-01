import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateBody, registerSchema } from '@/lib/validations';
import { generateBridgeKey } from '@/lib/getAccount';
import { logAuditEvent } from '@/lib/audit';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';

export async function POST(request: Request) {
    const rateLimitResponse = await checkLimit(request, Limiters.register);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const validation = await validateBody(request, registerSchema);
        if (!validation.success) {
            return validation.response;
        }

        const body = validation.data;

        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) {
            logAuditEvent('REGISTRATION_FAILED', null, { email: body.email, reason: 'email_already_registered' }).catch(console.error);
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(body.password, 12);
        
        // Generate bridge key for the new user
        const { key, keyId, keyHash } = generateBridgeKey();

        const user = await prisma.user.create({
            data: {
                email: body.email,
                password: hashedPassword,
                name: body.name ?? body.email.split('@')[0],
                bridgeKeyId: keyId,
                bridgeKeyHash: keyHash,
            },
        });

        // Create a default trading account for the new user
        // Use user ID in account number to ensure uniqueness
        await prisma.tradingAccount.create({
            data: {
                userId: user.id,
                name: 'Default Account',
                broker: 'Manual',
                accountNumber: `MANUAL-${user.id.slice(-8).toUpperCase()}`,
                currency: 'USD',
                leverage: 100,
                platform: 'METATRADER5',
                platformAccountId: `MANUAL-${user.id.slice(-8).toUpperCase()}`,
            },
        });

        return NextResponse.json({ 
            id: user.id, 
            email: user.email, 
            name: user.name,
            bridgeKey: key, // Return the bridge key once during registration
        });
    } catch (error) {
        console.error('[register]', error);
        logAuditEvent('REGISTRATION_FAILED', null, { reason: 'internal_error' }).catch(console.error);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}

export const runtime = 'nodejs';
