import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { generateBridgeKey } from '@/lib/getAccount';
import { ok, notFound } from '@/lib/api/responses';

export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            bridgeKeyId: true,
            bridgeKeyHash: true,
        },
    });

    if (!user) {
        return notFound('User');
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = forwardedHost ?? request.headers.get('host') ?? 'localhost:3000';
    const proto = forwardedHost ? forwardedProto : (host.startsWith('localhost') ? 'http' : 'https');
    const syncUrl = `${proto}://${host}/api/sync`;

    return ok({
        bridgeKey: null,
        bridgeKeyId: user.bridgeKeyId,
        isHashed: !!user.bridgeKeyHash,
        syncUrl,
    });
});

export const POST = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id;

    const { key, keyId, keyHash } = generateBridgeKey();

    await prisma.user.update({
        where: { id: userId },
        data: {
            bridgeKeyId: keyId,
            bridgeKeyHash: keyHash,
        },
    });

    return ok({ bridgeKey: key, bridgeKeyId: keyId });
});

export const runtime = 'nodejs';
