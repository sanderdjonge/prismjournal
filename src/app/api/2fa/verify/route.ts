import { NextRequest } from 'next/server';
import { usedTotpCodes, cleanupUsedCodes, pendingTotpSecrets, cleanupPendingSecrets } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { verifySync } from 'otplib';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/api/responses';

const verify2faSchema = z.object({
    code: z.string().length(6),
});

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
    const rateLimitResult = await checkLimit(request, { ...Limiters.register, name: '2fa-verify', limit: 5 });
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateBody(request, verify2faSchema);
    if (!validation.success) return validation.response;
    const { code } = validation.data;

    cleanupPendingSecrets();
    const pending = pendingTotpSecrets.get(session.user.id);
    if (!pending) {
        return badRequest('Setup session expired. Please restart 2FA setup.');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { totpEnabled: true }
    });

    if (user?.totpEnabled) {
        return badRequest('2FA already enabled');
    }

    cleanupUsedCodes();
    const codeKey = `${session.user.id}:${code}`;
    if (usedTotpCodes.has(codeKey)) {
        return badRequest('Invalid verification code');
    }

    const result = verifySync({ secret: pending.secret, token: code });
    if (!result.valid) {
        return badRequest('Invalid verification code');
    }

    usedTotpCodes.set(codeKey, Date.now() + 90_000);

    pendingTotpSecrets.delete(session.user.id);

    await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: true, totpSecret: pending.secret }
    });

    return ok({ success: true, message: '2FA enabled successfully' });
});
