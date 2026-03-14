import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    await prisma.media.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
