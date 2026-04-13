import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { formatDistanceToNow } from '@/lib/formatTime';
import { validateBody, tradeCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import { cacheDelete } from '@/lib/api/cache';
import { evaluateAndRecordCompliance, TradeContext } from '@/lib/services/strategy-compliance.service';
import { ok, badRequest } from '@/lib/api/responses';
import logger from '@/lib/logger';

export const GET = withAuth(async (request, _ctx, session) => {
    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    if (allAccounts.length === 0) return ok({ trades: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

    const accountIds = allAccounts.map((a) => a.id);

    const searchParams = (request as NextRequest).nextUrl.searchParams;

    const symbol = searchParams.get('symbol');
    const side = searchParams.get('side');
    const result = searchParams.get('result');
    const closeReasonFilter = searchParams.get('closeReason');
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const search = searchParams.get('q');
    const tagFilter = searchParams.get('tag');
    const accountFilter = searchParams.get('account');
    const strategyFilter = searchParams.get('strategyId');

    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);

    const filteredAccountIds = accountFilter && accountIds.includes(accountFilter)
        ? [accountFilter]
        : accountIds;

    const where: Prisma.TradeWhereInput = {
        accountId: { in: filteredAccountIds },
    };

    if (symbol) {
        where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    if (side === 'LONG' || side === 'SHORT') {
        where.direction = side;
    }

    if (result === 'WIN') {
        where.AND = [
            { exitTime: { not: null } },
            { pnl: { gt: 0 } }
        ];
    } else if (result === 'LOSS') {
        where.AND = [
            { exitTime: { not: null } },
            { pnl: { lt: 0 } }
        ];
    } else if (result === 'OPEN') {
        where.exitTime = null;
    }

    if (closeReasonFilter) {
        where.closeReason = closeReasonFilter;
    }

    if (dateFrom && dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.entryTime = { gte: new Date(dateFrom), lt: endDate };
    } else if (dateFrom) {
        where.entryTime = { gte: new Date(dateFrom) };
    } else if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.entryTime = { lt: endDate };
    }

    if (search) {
        where.OR = [
            { symbol: { contains: search, mode: 'insensitive' } },
            { ticket: { contains: search } },
            { notes: { contains: search, mode: 'insensitive' } },
            { entryReason: { contains: search, mode: 'insensitive' } },
            { exitReason: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (strategyFilter === 'none') {
        where.strategyId = null;
    } else if (strategyFilter) {
        where.strategyId = strategyFilter;
    }

    let tagFilterIds: string[] | null = null;
    if (tagFilter) {
        const tradeTags = await prisma.tradeTag.findMany({
            where: { tagId: tagFilter },
            select: { tradeId: true },
        });
        tagFilterIds = tradeTags.map((tt) => tt.tradeId);
        if (tagFilterIds.length === 0) {
            return ok({ trades: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
        }
    }

    if (tagFilterIds) {
        where.id = { in: tagFilterIds };
    }

    const idsOnly = searchParams.get('idsOnly') === 'true';
    if (idsOnly) {
        const ids = await prisma.trade.findMany({
            where,
            select: { id: true },
            orderBy: { entryTime: 'desc' },
        });
        return ok({ ids: ids.map(t => t.id) });
    }

    const [trades, total] = await Promise.all([
        prisma.trade.findMany({
            where,
            orderBy: { entryTime: 'desc' },
            include: {
                strategy: true,
                account: { select: { name: true } },
                tags: {
                    include: {
                        tag: {
                            select: { id: true, name: true, color: true },
                        },
                    },
                },
                _count: { select: { media: { where: { type: { not: 'SHARE_CARD' } } } } },
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.trade.count({ where }),
    ]);

    const formatted = trades.map((t) => ({
        id: t.id,
        ticket: t.ticket,
        symbol: t.symbol,
        type: t.direction as 'LONG' | 'SHORT',
        volume: t.volume,
        entry: t.entryPrice,
        exit: t.exitPrice ?? 0,
        stopLoss: t.stopLoss ?? null,
        initialStopLoss: t.initialStopLoss ?? null,
        takeProfit: t.takeProfit ?? null,
        commission: t.commission ?? 0,
        swap: t.swap ?? 0,
        pnl: t.pnl ?? 0,
        time: formatDistanceToNow(t.entryTime),
        mood: t.mood,
        planCompliance: t.planCompliance,
        closeReason: t.closeReason ?? null,
        notes: t.notes,
        strategy: t.strategy?.name ?? null,
        strategyId: t.strategyId ?? null,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime?.toISOString() ?? null,
        tags: t.tags.map((tt) => tt.tag),
        accountId: t.accountId,
        accountName: t.account?.name ?? null,
        screenshotCount: t._count.media,
        mae: t.mae ?? null,
        mfe: t.mfe ?? null,
        entryRating: t.entryRating ?? null,
        exitRating: t.exitRating ?? null,
        managementRating: t.managementRating ?? null,
        rMultiple: t.rMultiple ?? null,
    }));

    return ok({
        trades: formatted,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
});

export const POST = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;

    const defaultAccount = await prisma.tradingAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
    });
    if (!defaultAccount) return badRequest('No account configured');

    const validation = await validateBody(req, tradeCreateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    let account = defaultAccount;
    if (body.accountId && body.accountId !== defaultAccount.id) {
        const specified = await prisma.tradingAccount.findFirst({
            where: { id: body.accountId, userId, isActive: true },
        });
        if (specified) account = specified;
    }

    let strategyId: string | null = null;
    if (body.strategyId) {
        strategyId = body.strategyId;
    } else if (body.strategy) {
        const existingStrategy = await prisma.strategy.findFirst({
            where: {
                name: body.strategy,
                userId: account.userId,
            },
        });
        strategyId = existingStrategy?.id || null;
    }

    const ticket = `MANUAL-${Date.now()}`;
    const now = new Date();

    const status = body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const isClosed = status === 'CLOSED';

    const trade = await prisma.trade.create({
        data: {
            accountId: account.id,
            ticket,
            symbol: body.symbol.toUpperCase(),
            direction: body.type.toUpperCase() as 'LONG' | 'SHORT',
            status,
            volume: body.volume,
            entryPrice: body.entryPrice,
            exitPrice: isClosed ? body.exitPrice ?? null : null,
            pnl: isClosed ? body.pnl ?? null : null,
            entryTime: now,
            exitTime: isClosed ? now : null,
            strategyId,
            mood: body.mood ?? null,
            planCompliance: body.planCompliance ?? null,
            notes: body.notes ?? null,
            takeProfit: body.takeProfit ?? null,
            stopLoss: body.stopLoss ?? null,
        },
        include: { strategy: true },
    });

    if (trade.strategyId && trade.status === 'CLOSED' && trade.exitTime) {
        try {
            const tradeContext: TradeContext = {
                id: trade.id,
                accountId: account.id,
                userId,
                strategyId: trade.strategyId,
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                stopLoss: trade.stopLoss,
                takeProfit: trade.takeProfit,
                volume: trade.volume,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                pnl: trade.pnl,
                initialStopLoss: trade.initialStopLoss,
            };
            await evaluateAndRecordCompliance(tradeContext, trade.strategyId);
        } catch (err) {
            logger.error({ err }, '[trades] Failed to evaluate compliance');
        }
    }

    cacheDelete(`dashboard:${userId}`);
    cacheDelete(`analytics:${userId}`);

    return ok({
        id: trade.id,
        ticket: trade.ticket,
        symbol: trade.symbol,
        type: trade.direction === 'LONG' ? 'BUY' : 'SELL',
        volume: trade.volume,
        entry: trade.entryPrice,
        exit: trade.exitPrice ?? 0,
        pnl: trade.pnl ?? 0,
        time: 'Just now',
        mood: trade.mood,
        planCompliance: trade.planCompliance,
        notes: trade.notes,
        strategy: trade.strategy?.name ?? null,
    });
});

export const runtime = 'nodejs';
