import { NextRequest } from 'next/server';
import { badRequest, notFound, ok } from '@/lib/api/responses';
import { usedTotpCodes, cleanupUsedCodes } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';

const disable2faSchema = z.object({
    password: z.string().min(1),
    code: z.string().length(6),
});

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
    const rateLimitResult = await checkLimit(request, { ...Limiters.register, name: '2fa-disable', limit: 5 });
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateBody(request, disable2faSchema);
    if (!validation.success) return validation.response;
    const { password, code } = validation.data;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            password: true,
            totpSecret: true,
            totpEnabled: true
        }
    });

    if (!user || !user.password) {
        return notFound('User');
    }

    if (!user.totpEnabled) {
        return badRequest('2FA is not enabled');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return badRequest('Invalid password');
    }

    if (!user.totpSecret) {
        return badRequest('2FA secret not found');
    }

    cleanupUsedCodes();
    const codeKey = `${session.user.id}:${code}`;
    if (usedTotpCodes.has(codeKey)) {
        return badRequest('Invalid verification code');
    }

    const result = verifySync({ secret: user.totpSecret, token: code });
    if (!result.valid) {
        return badRequest('Invalid verification code');
    }

    usedTotpCodes.set(codeKey, Date.now() + 90_000);

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            totpEnabled: false,
            totpSecret: null
        }
    });

    return ok({ success: true, message: '2FA disabled successfully' });
});
