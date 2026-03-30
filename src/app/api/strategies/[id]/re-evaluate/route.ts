import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { evaluateAndRecordCompliance, TradeContext } from '@/lib/services/strategy-compliance.service';

// POST /api/strategies/[id]/re-evaluate - Re-evaluate compliance for all trades with this strategy
export const POST = withAuth(async (req: NextRequest, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
    const strategyId = id;

    // Verify strategy ownership
    const strategy = await prisma.strategy.findFirst({
        where: { id: strategyId, userId: session.user.id },
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Get all closed trades with this strategy
    const trades = await prisma.trade.findMany({
        where: {
            strategyId,
            status: 'CLOSED',
            exitTime: { not: null },
        },
        include: {
            account: {
                select: { userId: true },
            },
        },
    });

    // Clear existing violations for this strategy
    await prisma.strategyViolation.deleteMany({
        where: { strategyId },
    });

    let evaluatedCount = 0;
    let violationCount = 0;
    const errors: string[] = [];

    for (const trade of trades) {
        try {
            const tradeContext: TradeContext = {
                id: trade.id,
                accountId: trade.accountId,
                userId: trade.account.userId,
                strategyId,
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                stopLoss: trade.stopLoss,
                takeProfit: trade.takeProfit,
                volume: trade.volume,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime!,
                pnl: trade.pnl,
                initialStopLoss: trade.initialStopLoss,
            };

            const result = await evaluateAndRecordCompliance(tradeContext, strategyId);
            evaluatedCount++;
            violationCount += result.violations.length;
        } catch (err) {
            errors.push(`Trade ${trade.ticket}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    return NextResponse.json({
        success: true,
        strategyId,
        strategyName: strategy.name,
        tradesEvaluated: evaluatedCount,
        totalViolations: violationCount,
        errors: errors.length > 0 ? errors : undefined,
    });
});

export const runtime = 'nodejs';