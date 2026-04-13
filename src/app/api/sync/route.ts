import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getUserByBridgeKey, getAccountByPlatformId } from '@/lib/getAccount';
import { validateBody, syncPayloadSchema, type SyncTrade } from '@/lib/validations';
import { upsertSyncTrade } from '@/lib/services/trade-sync.service';
import { saveEquitySnapshot } from '@/lib/services/equity.service';
import { cacheDelete } from '@/lib/api/cache';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import { ok, badRequest, unauthorized, internalError } from '@/lib/api/responses';

export async function POST(request: Request) {
    const rateLimitResponse = await checkLimit(request, Limiters.sync);
    if (rateLimitResponse) return rateLimitResponse;

    const bridgeKey = request.headers.get('X-Bridge-Key');
    if (!bridgeKey) {
        return badRequest('Missing X-Bridge-Key');
    }

    const user = await getUserByBridgeKey(bridgeKey);
    if (!user) {
        return unauthorized();
    }

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
        let account;
        
        if (payload.platformAccountId) {
            account = await getAccountByPlatformId(
                user.id,
                payload.platform ?? 'METATRADER5',
                payload.platformAccountId
            );
            
            if (!account) {
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
            account = user.accounts[0];
            
            if (!account) {
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
        return ok({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Sync error');
        return internalError();
    }
}

export const runtime = 'nodejs';
