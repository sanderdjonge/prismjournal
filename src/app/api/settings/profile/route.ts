import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const DEFAULT_STATS = {
    showWinRate: true,
    showEquityCurve: true,
    showPrismScore: false,
};

export const GET = withAuth(async (_req, _ctx, session) => {
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            publicProfileEnabled: true,
            publicProfileId: true,
            publicProfileStats: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
        publicProfileEnabled: user.publicProfileEnabled,
        publicProfileId: user.publicProfileId,
        publicProfileStats: (user.publicProfileStats as typeof DEFAULT_STATS | null) ?? DEFAULT_STATS,
    });
});

const patchSchema = z.object({
    publicProfileEnabled: z.boolean().optional(),
    publicProfileStats: z.object({
        showWinRate: z.boolean(),
        showEquityCurve: z.boolean(),
        showPrismScore: z.boolean(),
    }).optional(),
});

export const PATCH = withAuth(async (req, _ctx, session) => {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
    }

    const { publicProfileEnabled, publicProfileStats } = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (publicProfileEnabled !== undefined) {
        updateData.publicProfileEnabled = publicProfileEnabled;

        // Generate a stable public profile ID on first activation
        if (publicProfileEnabled) {
            const existing = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { publicProfileId: true },
            });
            if (!existing?.publicProfileId) {
                // Use crypto.randomUUID for a URL-safe unique ID
                const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
                updateData.publicProfileId = raw;
            }
        }
    }

    if (publicProfileStats !== undefined) {
        updateData.publicProfileStats = publicProfileStats;
    }

    const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
            publicProfileEnabled: true,
            publicProfileId: true,
            publicProfileStats: true,
        },
    });

    return NextResponse.json({
        publicProfileEnabled: updated.publicProfileEnabled,
        publicProfileId: updated.publicProfileId,
        publicProfileStats: (updated.publicProfileStats as typeof DEFAULT_STATS | null) ?? DEFAULT_STATS,
    });
});

export const runtime = 'nodejs';
