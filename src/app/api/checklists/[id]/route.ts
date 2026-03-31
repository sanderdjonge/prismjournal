import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, notFound } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    items: z.array(z.object({
        id: z.string().optional(), // existing items have id; new items don't
        label: z.string().min(1).max(200),
        required: z.boolean().default(false),
        order: z.number().int().min(0),
    })).optional(),
});

// PATCH /api/checklists/[id] — update name and/or replace items
export const PATCH = withAuth(async (req: NextRequest, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
    const checklist = await prisma.checklist.findFirst({ where: { id, userId: session.user.id } });
    if (!checklist) return notFound('Checklist not found');

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    // Replace items atomically if provided
    const updated = await prisma.$transaction(async (tx) => {
        if (parsed.data.items !== undefined) {
            await tx.checklistItem.deleteMany({ where: { checklistId: id } });
            await tx.checklistItem.createMany({
                data: parsed.data.items.map(item => ({
                    checklistId: id,
                    label: item.label,
                    required: item.required,
                    order: item.order,
                })),
            });
        }
        return tx.checklist.update({
            where: { id },
            data: { name: parsed.data.name ?? checklist.name },
            include: { items: { orderBy: { order: 'asc' } } },
        });
    });
    return ok({ checklist: updated });
});

// DELETE /api/checklists/[id]
export const DELETE = withAuth(async (_req: NextRequest, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
    const checklist = await prisma.checklist.findFirst({ where: { id, userId: session.user.id } });
    if (!checklist) return notFound('Checklist not found');
    await prisma.checklist.delete({ where: { id } });
    return ok({ deleted: true });
});

export const runtime = 'nodejs';
