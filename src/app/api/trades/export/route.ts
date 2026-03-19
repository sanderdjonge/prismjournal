import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { withAuth } from '@/lib/api/withAuth';

export const GET = withAuth(async (request, _ctx, session) => {
    const { searchParams } = new URL(request.url);
    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const accountFilter = searchParams.get('account');
    const filteredIds = accountFilter && accountIds.includes(accountFilter) ? [accountFilter] : accountIds;

    // Build filter conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { accountId: { in: filteredIds } };

    const side = searchParams.get('side');
    if (side && side !== 'ALL') {
        where.direction = side;
    }

    const result = searchParams.get('result');
    if (result === 'WIN') {
        where.pnl = { gt: 0 };
    } else if (result === 'LOSS') {
        where.pnl = { lt: 0 };
    } else if (result === 'OPEN') {
        where.exitTime = null;
    }

    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    if (dateFrom || dateTo) {
        where.entryTime = {};
        if (dateFrom) where.entryTime.gte = new Date(dateFrom);
        if (dateTo) where.entryTime.lte = new Date(dateTo);
    }

    const search = searchParams.get('q');
    if (search) {
        where.OR = [
            { symbol: { contains: search, mode: 'insensitive' } },
            { ticket: { contains: search, mode: 'insensitive' } },
        ];
    }

    const trades = await prisma.trade.findMany({
        where,
        orderBy: { entryTime: 'desc' },
    });

    // Generate CSV
    const headers = [
        'Ticket',
        'Symbol',
        'Direction',
        'Volume',
        'Entry Price',
        'Exit Price',
        'Stop Loss',
        'Take Profit',
        'P&L',
        'Commission',
        'Swap',
        'Entry Time',
        'Exit Time',
        'Mood',
        'Plan Compliance',
        'Strategy',
        'Notes',
    ];

    const rows = trades.map((t) => [
        t.ticket,
        t.symbol,
        t.direction,
        t.volume?.toString() ?? '',
        t.entryPrice?.toString() ?? '',
        t.exitPrice?.toString() ?? '',
        t.stopLoss?.toString() ?? '',
        t.takeProfit?.toString() ?? '',
        t.pnl?.toString() ?? '',
        t.commission?.toString() ?? '',
        t.swap?.toString() ?? '',
        t.entryTime?.toISOString() ?? '',
        t.exitTime?.toISOString() ?? '',
        t.mood ?? '',
        t.planCompliance ?? '',
        t.strategyId ?? '',
        t.notes ?? '',
    ]);

    const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="trades_${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
});

export const runtime = 'nodejs';
