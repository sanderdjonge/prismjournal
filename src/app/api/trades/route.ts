import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { formatDistanceToNow } from '@/lib/formatTime';
import { validateBody, tradeCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import { cacheDelete } from '@/lib/api/cache';

export const GET = withAuth(async (request, _ctx, session) => {
    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    if (allAccounts.length === 0) return NextResponse.json({ trades: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

    const accountIds = allAccounts.map((a) => a.id);

    const searchParams = (request as NextRequest).nextUrl.searchParams;

    // Filter parameters
    const symbol = searchParams.get('symbol');
    const side = searchParams.get('side'); // BUY/SELL
    const result = searchParams.get('result'); // WIN/LOSS/OPEN
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const search = searchParams.get('q'); // Search query
    const tagFilter = searchParams.get('tag'); // Tag ID filter
    const accountFilter = searchParams.get('account'); // Specific account ID filter

    // Pagination — cap limit to 500 to prevent runaway queries
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);

    // Build where clause — optionally restrict to specific account
    const filteredAccountIds = accountFilter && accountIds.includes(accountFilter)
        ? [accountFilter]
        : accountIds;

    const where: Prisma.TradeWhereInput = {
        accountId: { in: filteredAccountIds },
    };

    // Symbol filter (case-insensitive contains)
    if (symbol) {
        where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    // Side filter (BUY/SELL) - map to LONG/SHORT
    if (side && side !== 'ALL') {
        where.direction = side === 'BUY' ? 'LONG' : 'SHORT';
    }

    // Result filter (WIN/LOSS/OPEN)
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

    // Date range filter
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

    // Search filter (symbol, ticket, notes, entryReason, exitReason)
    if (search) {
        where.OR = [
            { symbol: { contains: search, mode: 'insensitive' } },
            { ticket: { contains: search } },
            { notes: { contains: search, mode: 'insensitive' } },
            { entryReason: { contains: search, mode: 'insensitive' } },
            { exitReason: { contains: search, mode: 'insensitive' } },
        ];
    }

    // Tag filter - find trades with a specific tag (by ID)
    let tagFilterIds: string[] | null = null;
    if (tagFilter) {
        const tradeTags = await prisma.tradeTag.findMany({
            where: { tagId: tagFilter },
            select: { tradeId: true },
        });
        tagFilterIds = tradeTags.map((tt) => tt.tradeId);
        // If no trades have this tag, return empty
        if (tagFilterIds.length === 0) {
            return NextResponse.json({ trades: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
        }
    }

    // Apply tag filter to where clause
    if (tagFilterIds) {
        where.id = { in: tagFilterIds };
    }

    // idsOnly mode — return all matching IDs, no pagination
    const idsOnly = searchParams.get('idsOnly') === 'true';
    if (idsOnly) {
        const ids = await prisma.trade.findMany({
            where,
            select: { id: true },
            orderBy: { entryTime: 'desc' },
        });
        return NextResponse.json({ ids: ids.map(t => t.id) });
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
                _count: { select: { media: true } },
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
        takeProfit: t.takeProfit ?? null,
        commission: t.commission ?? 0,
        swap: t.swap ?? 0,
        pnl: t.pnl ?? 0,
        time: formatDistanceToNow(t.entryTime),
        mood: t.mood,
        planCompliance: t.planCompliance,
        notes: t.notes,
        strategy: t.strategy?.name ?? null,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime?.toISOString() ?? null,
        tags: t.tags.map((tt) => tt.tag),
        accountId: t.accountId,
        accountName: t.account?.name ?? null,
        screenshotCount: t._count.media,
    }));

    return NextResponse.json({
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

    // Resolve default account for this user
    const defaultAccount = await prisma.tradingAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
    });
    if (!defaultAccount) return NextResponse.json({ error: 'No account configured' }, { status: 400 });

    const validation = await validateBody(req, tradeCreateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    // Use provided accountId or fall back to default account
    let account = defaultAccount;
    if (body.accountId && body.accountId !== defaultAccount.id) {
        const specified = await prisma.tradingAccount.findFirst({
            where: { id: body.accountId, userId, isActive: true },
        });
        if (specified) account = specified;
    }

    // Find or create strategy
    let strategyId: string | null = null;
    if (body.strategy) {
        const strat = await prisma.strategy.upsert({
            where: { id: `strat_${body.strategy.replace(/\W+/g, '_').toLowerCase()}` },
            update: {},
            create: {
                id: `strat_${body.strategy.replace(/\W+/g, '_').toLowerCase()}`,
                name: body.strategy,
                userId: account.userId,
            },
        });
        strategyId = strat.id;
    }

    const ticket = `MANUAL-${Date.now()}`;
    const now = new Date();

    // Determine status - default to OPEN if not specified
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

    cacheDelete(`dashboard:${userId}`);
    cacheDelete(`analytics:${userId}`);

    return NextResponse.json({
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
