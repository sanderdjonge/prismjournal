import { withAuth } from '@/lib/api/withAuth';
import { ok, created, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const createTagSchema = z.object({
    name: z.string().min(1).max(50).trim(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id;
    
    const tags = await prisma.tag.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { trades: true } } },
    });
    
    return ok({ tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        tradeCount: tag._count.trades,
    })) });
});

export const POST = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;
    
    const body = await req.json().catch(() => null);
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors));

    const existing = await prisma.tag.findUnique({
        where: { userId_name: { userId, name: parsed.data.name } },
    });
    if (existing) return ok(existing); // idempotent

    const tag = await prisma.tag.create({
        data: { userId, name: parsed.data.name, color: parsed.data.color },
    });
    
    return created(tag);
});

export const runtime = 'nodejs';
