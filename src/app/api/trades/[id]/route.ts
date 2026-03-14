import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBody, tradeUpdateSchema } from '@/lib/validations';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const media = await prisma.media.findMany({
        where: { tradeId: id },
        select: { id: true, url: true, timeframe: true },
    });

    return NextResponse.json({ media });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const validation = await validateBody(request, tradeUpdateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    // Get the trade to find the account/user for strategy creation
    const existingTrade = await prisma.trade.findUnique({
        where: { id },
        include: { account: true },
    });
    if (!existingTrade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Handle strategy - find or create
    let strategyId: string | null | undefined = undefined;
    if (body.strategy !== undefined) {
        if (body.strategy) {
            const strat = await prisma.strategy.upsert({
                where: { id: `strat_${body.strategy.replace(/\W+/g, '_').toLowerCase()}` },
                update: {},
                create: {
                    id: `strat_${body.strategy.replace(/\W+/g, '_').toLowerCase()}`,
                    name: body.strategy,
                    userId: existingTrade.account.userId,
                },
            });
            strategyId = strat.id;
        } else {
            strategyId = null;
        }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (body.symbol !== undefined) updateData.symbol = body.symbol;
    if (body.type !== undefined) updateData.direction = body.type;
    if (body.volume !== undefined) updateData.volume = body.volume;
    if (body.entryPrice !== undefined) updateData.entryPrice = body.entryPrice;
    if (body.exitPrice !== undefined) updateData.exitPrice = body.exitPrice;
    if (body.pnl !== undefined) updateData.pnl = body.pnl;
    if (body.status !== undefined) updateData.status = body.status;
    if (strategyId !== undefined) updateData.strategyId = strategyId;
    if (body.mood !== undefined) updateData.mood = body.mood;
    if (body.planCompliance !== undefined) updateData.planCompliance = body.planCompliance;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.takeProfit !== undefined) updateData.takeProfit = body.takeProfit;
    if (body.stopLoss !== undefined) updateData.stopLoss = body.stopLoss;
    if (body.entryRating !== undefined) updateData.entryRating = body.entryRating;
    if (body.exitRating !== undefined) updateData.exitRating = body.exitRating;
    if (body.managementRating !== undefined) updateData.managementRating = body.managementRating;

    const trade = await prisma.trade.update({
        where: { id },
        data: updateData,
    });

    return NextResponse.json({ success: true, id: trade.id });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    await prisma.media.deleteMany({ where: { tradeId: id } });
    await prisma.trade.delete({ where: { id } });

    return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
