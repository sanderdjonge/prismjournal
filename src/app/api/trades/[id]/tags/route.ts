import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, notFound } from '@/lib/api/responses';

export const PUT = withAuth(async (req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
    const userId = session.user.id;

    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId } },
        select: { id: true },
    });
    if (!trade) {
        return notFound('Trade');
    }

    const body = await req.json().catch(() => null);
    const tagIds: string[] = Array.isArray(body?.tagIds) ? body.tagIds : [];

    if (tagIds.length > 0) {
        const validTags = await prisma.tag.findMany({
            where: { id: { in: tagIds }, userId },
            select: { id: true },
        });
        const validIds = validTags.map(t => t.id);
        const invalid = tagIds.filter(id => !validIds.includes(id));
        if (invalid.length > 0) {
            return badRequest('Invalid tag IDs');
        }
    }

    await prisma.tradeTag.deleteMany({ where: { tradeId: id } });
    if (tagIds.length > 0) {
        await prisma.tradeTag.createMany({
            data: tagIds.map(tagId => ({ tradeId: id, tagId })),
        });
    }

    return ok({ success: true });
});

export const runtime = 'nodejs';
