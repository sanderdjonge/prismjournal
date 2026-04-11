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

        // Check if invite-only mode is enabled
        const systemSettings = await prisma.systemSettings.findUnique({
            where: { id: 'system' },
        });

        const hashedPassword = await bcrypt.hash(body.password, 12);
        
        const { key, keyId, keyHash } = generateBridgeKey();

        const user = await prisma.$transaction(async (tx) => {
            if (systemSettings?.inviteOnlyMode) {
                if (!body.invite) {
                    throw Object.assign(new Error('Invite token required'), { status: 400 });
                }

                // Use atomic conditional update to prevent double-spend race condition.
                // updateMany returns { count } — if another tx already consumed the token,
                // count will be 0 and we reject.
                const { count: consumed } = await tx.inviteToken.updateMany({
                    where: {
                        token: body.invite,
                        usedAt: null,
                        expiresAt: body.invite ? { gt: new Date() } : undefined,
                    },
                    data: { usedAt: new Date() },
                });

                if (consumed === 0) {
                    const inviteToken = await tx.inviteToken.findUnique({
                        where: { token: body.invite },
                    });
                    if (!inviteToken) {
                        throw Object.assign(new Error('Invalid invite token'), { status: 400 });
                    }
                    if (inviteToken.usedAt) {
                        throw Object.assign(new Error('Invite token already used'), { status: 400 });
                    }
                    if (inviteToken.expiresAt && new Date() > inviteToken.expiresAt) {
                        throw Object.assign(new Error('Invite token expired'), { status: 400 });
                    }
                    if (inviteToken.email && inviteToken.email !== body.email) {
                        throw Object.assign(new Error('Email does not match invite'), { status: 400 });
                    }
                    throw Object.assign(new Error('Invite token is no longer valid'), { status: 400 });
                }

                // Check email match BEFORE creating user (avoid wasting the token on wrong email)
                const inviteRecord = await tx.inviteToken.findUnique({
                    where: { token: body.invite },
                });
                if (inviteRecord?.email && inviteRecord.email !== body.email) {
                    throw Object.assign(new Error('Email does not match invite'), { status: 400 });
                }
            }

            const existing = await tx.user.findUnique({ where: { email: body.email } });
            if (existing) {
                throw Object.assign(new Error('Email already registered'), { status: 409 });
            }

            const newUser = await tx.user.create({
                data: {
                    email: body.email,
                    password: hashedPassword,
                    name: body.name ?? body.email.split('@')[0],
                    bridgeKeyId: keyId,
                    bridgeKeyHash: keyHash,
                },
            });

            // Create default trading account INSIDE the transaction to guarantee atomicity.
            // If this fails the entire registration rolls back — no orphaned users.
            await tx.tradingAccount.create({
                data: {
                    userId: newUser.id,
                    name: 'Default Account',
                    broker: 'Manual',
                    accountNumber: `MANUAL-${newUser.id.slice(-8).toUpperCase()}`,
                    currency: 'USD',
                    leverage: 100,
                    platform: 'METATRADER5',
                    platformAccountId: `MANUAL-${newUser.id.slice(-8).toUpperCase()}`,
                },
            });

            // Update invite token with user ID inside the transaction
            if (systemSettings?.inviteOnlyMode && body.invite) {
                await tx.inviteToken.update({
                    where: { token: body.invite },
                    data: { usedBy: newUser.id },
                });
            }

            return newUser;
        });

        return NextResponse.json({ 
            id: user.id, 
            email: user.email, 
            name: user.name,
            bridgeKey: key, // Return the bridge key once during registration
        });
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        const status = err?.status ?? 500;
        const message = err?.message ?? 'Registration failed. Please try again.';
        if (status >= 400 && status < 500) {
            return NextResponse.json({ error: message }, { status });
        }
        console.error('[register]', error);
        logAuditEvent('REGISTRATION_FAILED', null, { reason: 'internal_error' }).catch(console.error);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}

export const runtime = 'nodejs';
