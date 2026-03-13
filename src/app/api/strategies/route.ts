import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/strategies - List all strategies for the current user
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const strategies = await prisma.strategy.findMany({
        where: { userId: session.user.id },
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { trades: true }
            }
        }
    });

    return NextResponse.json({ strategies });
}

// POST /api/strategies - Create a new strategy
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Strategy name is required' }, { status: 400 });
    }

    // Check if strategy already exists for this user
    const existing = await prisma.strategy.findFirst({
        where: {
            userId: session.user.id,
            name: { equals: name.trim(), mode: 'insensitive' }
        }
    });

    if (existing) {
        return NextResponse.json({ error: 'Strategy already exists' }, { status: 409 });
    }

    const strategy = await prisma.strategy.create({
        data: {
            userId: session.user.id,
            name: name.trim(),
            description: description?.trim() || null,
        }
    });

    return NextResponse.json({ strategy });
}

// DELETE /api/strategies - Delete a strategy
export async function DELETE(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Strategy ID is required' }, { status: 400 });
    }

    // Verify ownership
    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id }
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Unlink trades from this strategy before deleting
    await prisma.trade.updateMany({
        where: { strategyId: id },
        data: { strategyId: null }
    });

    await prisma.strategy.delete({ where: { id } });

    return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
