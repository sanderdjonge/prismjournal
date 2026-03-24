import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFile } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';

export const GET = withAuth(async (_req, ctx, session) => {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    // Get media record
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
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Verify user owns the trade
    if (media.trade.account.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // Read file from storage
        const fileBuffer = await readFile(media.filename);

        // Return file with proper content type
        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                'Content-Type': media.mimetype,
                'Content-Length': media.size.toString(),
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Error reading file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
});

export const runtime = 'nodejs';
