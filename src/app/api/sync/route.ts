import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getUserByBridgeKey, getAccountByPlatformId } from '@/lib/getAccount';
import { validateBody, syncPayloadSchema, type SyncTrade } from '@/lib/validations';
import { upsertSyncTrade } from '@/lib/services/trade-sync.service';
import { saveEquitySnapshot } from '@/lib/services/equity.service';
import { cacheDelete } from '@/lib/api/cache';

/**
 * POST /api/sync
 * 
 * Sync endpoint for MT5/cTrader bridge.
 * 
 * With multi-account support:
 * - Bridge key authenticates the user (now on User model, not TradingAccount)
 * - platform + platformAccountId in payload routes to correct account
 * - If no platform info provided, uses first active account (backwards compatibility)
 */
export async function POST(request: Request) {
    const bridgeKey = request.headers.get('X-Bridge-Key');
    if (!bridgeKey) {
        return NextResponse.json({ error: 'Missing X-Bridge-Key' }, { status: 400 });
    }

    const user = await getUserByBridgeKey(bridgeKey);
    if (!user) {
        return NextResponse.json({ error: 'Invalid bridge key' }, { status: 401 });
    }

    // Raw body log — helps diagnose silent validation rejections
    let rawBody: unknown;
    try {
        rawBody = await request.clone().json();
    } catch {
        rawBody = '<invalid json>';
    }
    logger.info({ userId: user.id, rawBody }, '[sync] raw payload received');

    const validation = await validateBody(request, syncPayloadSchema);
    if (!validation.success) {
        logger.warn({ userId: user.id, rawBody }, '[sync] validation failed');
        return validation.response;
    }

    const payload = validation.data;

    try {
        // Determine which account to use
        let account;
        
        if (payload.platformAccountId) {
            // Multi-account routing: find account by platform + platformAccountId
            account = await getAccountByPlatformId(
                user.id,
                payload.platform ?? 'METATRADER5',
                payload.platformAccountId
            );
            
            if (!account) {
                // Auto-create account if it doesn't exist
                const platform = payload.platform ?? 'METATRADER5';
                account = await prisma.tradingAccount.create({
                    data: {
                        userId: user.id,
                        name: `${platform} #${payload.platformAccountId}`,
                        platform: platform,
                        platformAccountId: payload.platformAccountId,
                        accountNumber: payload.platformAccountId,
                        currency: 'USD',
                        leverage: 100,
                    },
                });
            }
        } else {
            // Backwards compatibility: use first active account
            account = user.accounts[0];
            
            if (!account) {
                // Create default account if none exists
                account = await prisma.tradingAccount.create({
                    data: {
                        userId: user.id,
                        name: 'Default Account',
                        platform: 'METATRADER5',
                        currency: 'USD',
                        leverage: 100,
                    },
                });
            }
        }

        if (payload.type === 'TRADE_UPDATE') {
            await upsertSyncTrade(account.id, account.userId, payload.trade as SyncTrade, payload.isHistorySync ?? false);
        } else if (payload.type === 'EQUITY_SNAPSHOT') {
            await saveEquitySnapshot(account.id, account.userId, payload.snapshot);
        }
        cacheDelete(`dashboard:${user.id}`);
        cacheDelete(`analytics:${user.id}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Sync error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const runtime = 'nodejs';
