import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';

export async function GET(request: Request) {
    const rateLimitResponse = await checkLimit(request, Limiters.api);
    if (rateLimitResponse) return rateLimitResponse;

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
