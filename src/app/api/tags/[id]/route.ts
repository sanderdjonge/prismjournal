import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateTagSchema = z.object({
    name: z.string().min(1).max(50).trim().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);
    const userId = session.user.id;

    const tag = await prisma.tag.findFirst({
        where: { id, userId },
        include: { _count: { select: { trades: true } } },
    });

    if (!tag) return notFound('Tag not found');

    return ok({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        tradeCount: tag._count.trades,
    });
});

export const PATCH = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);
    const userId = session.user.id;

    const body = await req.json().catch(() => null);
    const parsed = updateTagSchema.safeParse(body);
    if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors));

    // Check tag exists and belongs to user
    const existing = await prisma.tag.findFirst({
        where: { id, userId },
    });
    if (!existing) return notFound('Tag not found');

    // If renaming, check for duplicate name
    if (parsed.data.name && parsed.data.name !== existing.name) {
        const duplicate = await prisma.tag.findUnique({
            where: { userId_name: { userId, name: parsed.data.name } },
        });
        if (duplicate) return badRequest('A tag with this name already exists');
    }

    const updated = await prisma.tag.update({
        where: { id },
        data: parsed.data,
        include: { _count: { select: { trades: true } } },
    });

    return ok({
        id: updated.id,
        name: updated.name,
        color: updated.color,
        tradeCount: updated._count.trades,
    });
});

export const DELETE = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);
    const userId = session.user.id;

    // Check tag exists and belongs to user
    const existing = await prisma.tag.findFirst({
        where: { id, userId },
    });
    if (!existing) return notFound('Tag not found');

    // Delete the tag (this will also remove the tag from all trades via the relation table)
    await prisma.tag.delete({
        where: { id },
    });

    return ok({ success: true });
});

export const runtime = 'nodejs';
