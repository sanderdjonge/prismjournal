import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { ok, created, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
    name: z.string().min(1).max(100),
    items: z.array(z.object({
        label: z.string().min(1).max(200),
        required: z.boolean().default(false),
        order: z.number().int().min(0),
    })).default([]),
});

// GET /api/checklists — list user's checklists with items
export const GET = withAuth(async (_req: NextRequest, _ctx, session) => {
    const checklists = await prisma.checklist.findMany({
        where: { userId: session.user.id },
        include: { items: { orderBy: { order: 'asc' } }, _count: { select: { strategies: true } } },
        orderBy: { createdAt: 'desc' },
    });
    return ok({ checklists });
});

// POST /api/checklists — create new checklist with items
export const POST = withAuth(async (req: NextRequest, _ctx, session) => {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const checklist = await prisma.checklist.create({
        data: {
            userId: session.user.id,
            name: parsed.data.name,
            items: { create: parsed.data.items },
        },
        include: { items: { orderBy: { order: 'asc' } } },
    });
    return created({ checklist });
});

export const runtime = 'nodejs';
