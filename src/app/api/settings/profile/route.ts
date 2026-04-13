import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { ok, badRequest, notFound } from '@/lib/api/responses';

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
        return notFound('User');
    }

    return ok({
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
        return badRequest('Invalid JSON');
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return badRequest('Invalid request');
    }

    const { publicProfileEnabled, publicProfileStats } = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (publicProfileEnabled !== undefined) {
        updateData.publicProfileEnabled = publicProfileEnabled;

        if (publicProfileEnabled) {
            const existing = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { publicProfileId: true },
            });
            if (!existing?.publicProfileId) {
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

    return ok({
        publicProfileEnabled: updated.publicProfileEnabled,
        publicProfileId: updated.publicProfileId,
        publicProfileStats: (updated.publicProfileStats as typeof DEFAULT_STATS | null) ?? DEFAULT_STATS,
    });
});

export const runtime = 'nodejs';
