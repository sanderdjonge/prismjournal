import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, badRequest, forbidden } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).max(50).trim().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

async function getTagForUser(id: string, userId: string) {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) return null;
    if (tag.userId !== userId) return 'forbidden';
    return tag;
}

export const PATCH = withAuth(async (req, ctx, session) => {
    const userId = session.user.id;
    const { id } = ctx.params as { id: string };
    
    const tag = await getTagForUser(id, userId);
    if (!tag) return notFound('Tag not found');
    if (tag === 'forbidden') return forbidden();

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors));

    const updated = await prisma.tag.update({ where: { id }, data: parsed.data });
    return ok(updated);
});

export const DELETE = withAuth(async (_req, ctx, session) => {
    const userId = session.user.id;
    const { id } = ctx.params as { id: string };
    
    const tag = await getTagForUser(id, userId);
    if (!tag) return notFound('Tag not found');
    if (tag === 'forbidden') return forbidden();

    await prisma.tag.delete({ where: { id } });
    return ok({ deleted: true });
});

export const runtime = 'nodejs';
