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
        select: { url: true, timeframe: true },
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

    const trade = await prisma.trade.update({
        where: { id },
        data: {
            mood: body.mood,
            planCompliance: body.planCompliance,
            notes: body.notes,
            entryRating: body.entryRating,
            exitRating: body.exitRating,
            managementRating: body.managementRating,
        },
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
