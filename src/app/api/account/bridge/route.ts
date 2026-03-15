import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount, generateBridgeKey } from '@/lib/getAccount';

export async function GET() {
    const account = await getDefaultAccount();
    if (!account) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const syncUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/sync`;

    return NextResponse.json({
        // Return bridgeKey for display only if it's a legacy plain-text key
        // For hashed keys, we can't show the full key (show null — user must regenerate)
        bridgeKey: account.bridgeKeyHash ? null : account.bridgeKey,
        bridgeKeyId: account.bridgeKeyId,
        isHashed: !!account.bridgeKeyHash,
        syncUrl,
        accountName: account.name,
        broker: account.broker,
    });
}

export async function POST() {
    const account = await getDefaultAccount();
    if (!account) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { key, keyId, keyHash } = generateBridgeKey();

    await prisma.tradingAccount.update({
        where: { id: account.id },
        data: {
            bridgeKeyId: keyId,
            bridgeKeyHash: keyHash,
            bridgeKey: null, // clear legacy plain-text key
        },
    });

    // Return the full key only once — it cannot be retrieved again
    return NextResponse.json({ bridgeKey: key, bridgeKeyId: keyId });
}

export const runtime = 'nodejs';
