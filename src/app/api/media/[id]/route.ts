import prisma from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, forbidden } from '@/lib/api/responses';

export const DELETE = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const media = await prisma.media.findUnique({
        where: { id },
        include: {
            trade: {
                include: {
                    account: true
                }
            }
        }
    });

    if (!media) {
        return notFound('Media');
    }

    if (media.trade.account.userId !== session.user.id) {
        return forbidden();
    }

    await deleteFile(media.filename);

    await prisma.media.delete({
        where: { id }
    });

    return ok({ success: true });
});

export const runtime = 'nodejs';
