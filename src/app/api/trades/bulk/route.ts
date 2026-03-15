import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getDefaultAccount } from '@/lib/getAccount';

const bulkDeleteSchema = z.object({
    action: z.literal('delete'),
    tradeIds: z.array(z.string()).min(1).max(100),
});

const bulkTagSchema = z.object({
    action: z.literal('tag'),
    tradeIds: z.array(z.string()).min(1).max(100),
    tagId: z.string(),
});

const bulkSchema = z.discriminatedUnion('action', [bulkDeleteSchema, bulkTagSchema]);

export const POST = withAuth(async (req, _ctx, session) => {
    const body = await req.json().catch(() => null);
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid request body');

    const account = await getDefaultAccount();
    if (!account) return badRequest('No account found');

    // Verify all tradeIds belong to this user's account
    const trades = await prisma.trade.findMany({
        where: { id: { in: parsed.data.tradeIds }, accountId: account.id },
        select: { id: true },
    });
    const validIds = trades.map((t) => t.id);

    if (validIds.length === 0) {
        return badRequest('No valid trades found');
    }

    if (parsed.data.action === 'delete') {
        await prisma.trade.deleteMany({ where: { id: { in: validIds } } });
        return ok({ deleted: validIds.length });
    }

    if (parsed.data.action === 'tag') {
        const { tagId } = parsed.data;
        // Verify tag belongs to user
        const tag = await prisma.tag.findFirst({
            where: { id: tagId, userId: session.user.id },
        });
        if (!tag) return badRequest('Tag not found');

        // Upsert TradeTag for each trade (skip if already tagged)
        await Promise.all(
            validIds.map((tradeId) =>
                prisma.tradeTag.upsert({
                    where: { tradeId_tagId: { tradeId, tagId } },
                    create: { tradeId, tagId },
                    update: {},
                })
            )
        );
        return ok({ tagged: validIds.length });
    }

    return badRequest('Unknown action');
});
