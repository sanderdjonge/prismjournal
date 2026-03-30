import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';

// Validation schemas
const createPreTradeNoteSchema = z.object({
    symbol: z.string().min(1).max(50),
    direction: z.enum(['LONG', 'SHORT']),
    body: z.string().min(1).max(10000),
    plannedEntry: z.number().optional(),
    accountId: z.string().optional(),
});

const updatePreTradeNoteSchema = z.object({
    body: z.string().min(1).max(10000).optional(),
    plannedEntry: z.number().optional(),
    status: z.enum(['PENDING', 'LINKED', 'NOT_RELEVANT', 'EXPIRED']).optional(),
    tradeId: z.string().optional(),
});

// GET /api/pre-trade-notes - List pre-trade notes
export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = {
        userId: session.user.id,
        ...(status && { status }),
    };

    const [notes, total] = await Promise.all([
        prisma.preTradeNote.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                trade: {
                    select: {
                        id: true,
                        symbol: true,
                        direction: true,
                        pnl: true,
                        entryTime: true,
                        exitTime: true,
                    },
                },
                account: {
                    select: { id: true, name: true },
                },
            },
        }),
        prisma.preTradeNote.count({ where }),
    ]);

    return NextResponse.json({ notes, total });
});

// POST /api/pre-trade-notes - Create a pre-trade note
export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const body = await request.json();
    const parsed = createPreTradeNoteSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid request body', details: parsed.error.errors },
            { status: 400 }
        );
    }

    const { symbol, direction, body: noteBody, plannedEntry, accountId } = parsed.data;

    // Verify account belongs to user if specified
    if (accountId) {
        const account = await prisma.tradingAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
        });
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
    }

    const note = await prisma.preTradeNote.create({
        data: {
            userId: session.user.id,
            symbol: symbol.toUpperCase(),
            direction,
            body: noteBody,
            plannedEntry,
            accountId,
        },
        include: {
            account: { select: { id: true, name: true } },
        },
    });

    return NextResponse.json(note, { status: 201 });
});

// PATCH /api/pre-trade-notes - Batch update (for linking)
export const PATCH = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
        return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    }

    const parsed = updatePreTradeNoteSchema.safeParse(updates);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid updates', details: parsed.error.errors },
            { status: 400 }
        );
    }

    // Verify note belongs to user
    const existing = await prisma.preTradeNote.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // If linking to a trade, verify trade exists and belongs to user
    if (parsed.data.tradeId) {
        const trade = await prisma.trade.findFirst({
            where: {
                id: parsed.data.tradeId,
                account: { userId: session.user.id },
            },
        });
        if (!trade) {
            return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
        }
    }

    const note = await prisma.preTradeNote.update({
        where: { id },
        data: {
            ...parsed.data,
            ...(parsed.data.tradeId && { linkedAt: new Date() }),
        },
        include: {
            trade: { select: { id: true, symbol: true, direction: true, pnl: true } },
            account: { select: { id: true, name: true } },
        },
    });

    return NextResponse.json(note);
});