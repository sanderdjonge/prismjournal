import { withAuth } from '@/lib/api/withAuth';
import { ok } from '@/lib/api/responses';
import prisma from '@/lib/prisma';

// GET /api/prop-firms - List all active prop firms
export const GET = withAuth(async (_req, _ctx, _session) => {
    const propFirms = await prisma.propFirm.findMany({
        where: { isActive: true },
        orderBy: { popularity: 'desc' },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            website: true,
            challengeType: true,
            dailyLossLimit: true,
            maxDrawdown: true,
            drawdownType: true,
            allowNewsTrading: true,
            allowWeekendHolding: true,
            allowEA: true,
            phasesConfig: true,
            hasScalingPlan: true,
            scalingConfig: true,
            popularity: true,
        },
    });

    return ok({ propFirms });
});
