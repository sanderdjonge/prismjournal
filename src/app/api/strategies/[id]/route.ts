import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { ok, notFound } from '@/lib/api/responses';
import { z } from 'zod';

const updateStrategySchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    checklistId: z.string().nullable().optional(),
});

export const GET = withAuth(async (
    _req: NextRequest,
    ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
        include: {
            trades: {
                where: { status: 'CLOSED' },
                select: { id: true, pnl: true, exitTime: true },
                orderBy: { exitTime: 'desc' },
                take: 10,
            },
            _count: {
                select: { trades: true },
            },
            checklist: {
                include: { items: { orderBy: { order: 'asc' } } },
            },
        },
    });

    if (!strategy) {
        return notFound('Strategy');
    }

    return ok(strategy);
});

export const PATCH = withAuth(async (
    req: NextRequest,
    ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const validation = await validateBody(req, updateStrategySchema);
    if (!validation.success) return validation.response;
    const body = validation.data;
    const { name, description, checklistId } = body;

    const existing = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return notFound('Strategy');
    }

    if (checklistId != null && checklistId !== '') {
        const checklist = await prisma.checklist.findFirst({
            where: { id: checklistId, userId: session.user.id },
        });
        if (!checklist) {
            return notFound('Checklist');
        }
    }

    const updateData: {
        name?: string;
        description?: string | null;
        checklistId?: string | null;
    } = {
        name: name ?? existing.name,
        description: description ?? existing.description,
    };
    if ('checklistId' in body) {
        updateData.checklistId = checklistId ?? null;
    }

    const updated = await prisma.strategy.update({
        where: { id },
        data: updateData,
        include: {
            checklist: {
                include: { items: { orderBy: { order: 'asc' } } },
            },
        },
    });

    return ok(updated);
});

export const DELETE = withAuth(async (
    _req: NextRequest,
    ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const existing = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return notFound('Strategy');
    }

    await prisma.trade.updateMany({
        where: { strategyId: id },
        data: { strategyId: null },
    });

    await prisma.strategy.delete({
        where: { id },
    });

    return ok({ success: true });
});

export const runtime = 'nodejs';
