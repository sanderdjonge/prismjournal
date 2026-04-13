import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, created, badRequest, notFound } from '@/lib/api/responses';

const createPreTradeNoteSchema = z.object({
    symbol: z.string().min(1).max(50),
    direction: z.enum(['LONG', 'SHORT']),
    body: z.string().min(1).max(10000),
    plannedEntry: z.number().optional(),
    accountId: z.string().optional(),
});

const updatePreTradeNoteSchema = z.object({
    id: z.string(),
    body: z.string().min(1).max(10000).optional(),
    plannedEntry: z.number().optional(),
    status: z.enum(['PENDING', 'LINKED', 'NOT_RELEVANT', 'EXPIRED']).optional(),
    tradeId: z.string().optional(),
});

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

    return ok({ notes, total });
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, createPreTradeNoteSchema);
    if (!validation.success) return validation.response;
    const { symbol, direction, body: noteBody, plannedEntry, accountId } = validation.data;

    if (accountId) {
        const account = await prisma.tradingAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
        });
        if (!account) {
            return notFound('Account');
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

    return created(note);
});

export const DELETE = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return badRequest('Note ID required');
    }

    const existing = await prisma.preTradeNote.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return notFound('Note');
    }

    await prisma.preTradeNote.delete({ where: { id } });

    return ok({ deleted: true });
});

export const PATCH = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, updatePreTradeNoteSchema);
    if (!validation.success) return validation.response;
    const { id, ...updates } = validation.data;

    const existing = await prisma.preTradeNote.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return notFound('Note');
    }

    if (updates.tradeId) {
        const trade = await prisma.trade.findFirst({
            where: {
                id: updates.tradeId,
                account: { userId: session.user.id },
            },
        });
        if (!trade) {
            return notFound('Trade');
        }
    }

    const note = await prisma.preTradeNote.update({
        where: { id },
        data: {
            ...updates,
            ...(updates.tradeId && { linkedAt: new Date() }),
        },
        include: {
            trade: { select: { id: true, symbol: true, direction: true, pnl: true } },
            account: { select: { id: true, name: true } },
        },
    });

    return ok(note);
});
