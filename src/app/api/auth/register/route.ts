import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateBody, registerSchema } from '@/lib/validations';
import { generateBridgeKey } from '@/lib/getAccount';
import { logAuditEvent } from '@/lib/audit';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export async function POST(request: Request) {
    const rateLimitResponse = await checkLimit(request, Limiters.register);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const validation = await validateBody(request, registerSchema);
        if (!validation.success) {
            return validation.response;
        }

        const body = validation.data;

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

                const { count: consumed } = await tx.inviteToken.updateMany({
                    where: {
                        token: body.invite,
                        usedAt: null,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } },
                        ],
                    },
                    data: { usedAt: new Date() },
                });

                if (consumed === 0) {
                    const inviteToken = await tx.inviteToken.findUnique({
                        where: { token: body.invite },
                    });

                    let reason = 'invalid'
                    if (!inviteToken) {
                        reason = 'not_found'
                    } else if (inviteToken.usedAt) {
                        reason = 'already_used'
                    } else if (inviteToken.expiresAt && new Date() > inviteToken.expiresAt) {
                        reason = 'expired'
                    } else if (inviteToken.email && inviteToken.email !== body.email) {
                        reason = 'email_mismatch'
                    }

                    logger.warn({ reason }, '[register] Invite token validation failed')
                    throw Object.assign(new Error('Invalid or expired invite token'), { status: 400 });
                }

                const inviteRecord = await tx.inviteToken.findUnique({
                    where: { token: body.invite },
                });
                if (inviteRecord?.email && inviteRecord.email !== body.email) {
                    logger.warn('[register] Invite token email mismatch')
                    throw Object.assign(new Error('Invalid or expired invite token'), { status: 400 });
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

            if (systemSettings?.inviteOnlyMode && body.invite) {
                await tx.inviteToken.update({
                    where: { token: body.invite },
                    data: { usedBy: newUser.id },
                });
            }

            return newUser;
        });

        return ok({ 
            id: user.id, 
            email: user.email, 
            name: user.name,
            bridgeKey: key,
        });
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        const status = err?.status ?? 500;
        const message = err?.message ?? 'Registration failed. Please try again.';
        if (status >= 400 && status < 500) {
            return badRequest(message);
        }
        logger.error({ err: error }, '[register]');
        logAuditEvent('REGISTRATION_FAILED', null, { reason: 'internal_error' }).catch(() => logger.error('Audit log for registration failed'));
        return internalError();
    }
}

export const runtime = 'nodejs';
