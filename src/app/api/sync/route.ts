import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAccountByBridgeKey } from '@/lib/getAccount';
import { validateBody, syncPayloadSchema, type SyncTrade } from '@/lib/validations';
import { upsertSyncTrade } from '@/lib/services/trade-sync.service';
import { saveEquitySnapshot } from '@/lib/services/equity.service';

export async function POST(request: Request) {
    const bridgeKey = request.headers.get('X-Bridge-Key');
    if (!bridgeKey) {
        return NextResponse.json({ error: 'Missing X-Bridge-Key' }, { status: 400 });
    }

    const account = await getAccountByBridgeKey(bridgeKey);
    if (!account) {
        return NextResponse.json({ error: 'Invalid bridge key' }, { status: 401 });
    }

    const validation = await validateBody(request, syncPayloadSchema);
    if (!validation.success) {
        return validation.response;
    }

    const payload = validation.data;

    try {
        if (payload.type === 'TRADE_UPDATE') {
            await upsertSyncTrade(account.id, account.userId, payload.trade as SyncTrade);
        } else if (payload.type === 'EQUITY_SNAPSHOT') {
            await saveEquitySnapshot(account.id, account.userId, payload.snapshot);
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const runtime = 'nodejs';
