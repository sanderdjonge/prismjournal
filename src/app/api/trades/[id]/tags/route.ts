import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// PUT /api/trades/[id]/tags — replace all tags on a trade
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    // Verify ownership
    const trade = await prisma.trade.findFirst({
        where: { id, account: { userId } },
        select: { id: true },
    });
    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const tagIds: string[] = Array.isArray(body?.tagIds) ? body.tagIds : [];

    // Validate that all tagIds belong to this user
    if (tagIds.length > 0) {
        const validTags = await prisma.tag.findMany({
            where: { id: { in: tagIds }, userId },
            select: { id: true },
        });
        const validIds = validTags.map(t => t.id);
        const invalid = tagIds.filter(id => !validIds.includes(id));
        if (invalid.length > 0) {
            return NextResponse.json({ error: 'Invalid tag IDs' }, { status: 400 });
        }
    }

    // Replace tags: delete all then re-insert
    await prisma.tradeTag.deleteMany({ where: { tradeId: id } });
    if (tagIds.length > 0) {
        await prisma.tradeTag.createMany({
            data: tagIds.map(tagId => ({ tradeId: id, tagId })),
        });
    }

    return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
