import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';
import { formatDistanceToNow } from '@/lib/formatTime';
import { validateBody, tradeCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    const account = await getDefaultAccount();
    if (!account) return NextResponse.json({ trades: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

    const searchParams = request.nextUrl.searchParams;

    // Filter parameters
    const symbol = searchParams.get('symbol');
    const side = searchParams.get('side'); // BUY/SELL
    const result = searchParams.get('result'); // WIN/LOSS/OPEN
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const search = searchParams.get('q'); // Search query

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: Prisma.TradeWhereInput = {
        accountId: account.id,
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

    // Search filter (symbol or ticket)
    if (search) {
        where.OR = [
            { symbol: { contains: search, mode: 'insensitive' } },
            { ticket: { contains: search } },
        ];
    }

    const [trades, total] = await Promise.all([
        prisma.trade.findMany({
            where,
            orderBy: { entryTime: 'desc' },
            include: { strategy: true },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.trade.count({ where }),
    ]);

    const formatted = trades.map((t) => ({
        id: t.id,
        ticket: t.ticket,
        symbol: t.symbol,
        type: t.direction as 'BUY' | 'SELL',
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
}

export async function POST(request: Request) {
    const account = await getDefaultAccount();
    if (!account) return NextResponse.json({ error: 'No account configured' }, { status: 500 });

    const validation = await validateBody(request, tradeCreateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

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
            direction: body.type === 'BUY' ? 'LONG' : 'SHORT',
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
}

export const runtime = 'nodejs';
