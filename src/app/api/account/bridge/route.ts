import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateBridgeKey } from '@/lib/getAccount';

/**
 * GET /api/account/bridge
 * Returns the bridge key info for the current user.
 * The bridge key is now per-user (not per-account) for multi-account support.
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    const userId = session?.user?.id;
    
    if (!userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            bridgeKeyId: true,
            bridgeKeyHash: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Derive sync URL from the request host so it works with any tunnel/domain
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = forwardedHost ?? request.headers.get('host') ?? 'localhost:3000';
    const proto = forwardedHost ? forwardedProto : (host.startsWith('localhost') ? 'http' : 'https');
    const syncUrl = `${proto}://${host}/api/sync`;

    return NextResponse.json({
        // For hashed keys, we can't show the full key (user must regenerate if lost)
        bridgeKey: null,
        bridgeKeyId: user.bridgeKeyId,
        isHashed: !!user.bridgeKeyHash,
        syncUrl,
    });
}

/**
 * POST /api/account/bridge
 * Regenerates the bridge key for the current user.
 * The new key is returned once and cannot be retrieved again.
 */
export async function POST() {
    const session = await auth();
    const userId = session?.user?.id;
    
    if (!userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { key, keyId, keyHash } = generateBridgeKey();

    await prisma.user.update({
        where: { id: userId },
        data: {
            bridgeKeyId: keyId,
            bridgeKeyHash: keyHash,
        },
    });

    // Return the full key only once — it cannot be retrieved again
    return NextResponse.json({ bridgeKey: key, bridgeKeyId: keyId });
}

export const runtime = 'nodejs';
