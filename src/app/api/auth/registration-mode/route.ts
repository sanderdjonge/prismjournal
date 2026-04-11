import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const settings = await prisma.systemSettings.findUnique({
            where: { id: 'system' },
            select: { inviteOnlyMode: true },
        });
        return NextResponse.json({ inviteOnlyMode: settings?.inviteOnlyMode ?? false });
    } catch {
        return NextResponse.json({ inviteOnlyMode: false });
    }
}
