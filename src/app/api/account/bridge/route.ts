import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';

export async function GET() {
    const account = await getDefaultAccount();
    if (!account) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const syncUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/sync`;

    return NextResponse.json({
        bridgeKey: account.bridgeKey,
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

    const newKey = `prism_${randomBytes(24).toString('hex')}`;

    await prisma.tradingAccount.update({
        where: { id: account.id },
        data: { bridgeKey: newKey },
    });

    return NextResponse.json({ bridgeKey: newKey });
}

export const runtime = 'nodejs';
