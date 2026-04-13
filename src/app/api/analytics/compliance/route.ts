import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { badRequest, ok, internalError } from '@/lib/api/responses';
import { getComplianceMetrics, getComplianceByStrategy, getComplianceTrend } from '@/lib/services/compliance-analytics.service';
import logger from '@/lib/logger';

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
    const { searchParams } = new URL(req.url);
    
    const accountId = searchParams.get('accountId');
    const strategyId = searchParams.get('strategyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const trend = searchParams.get('trend') === 'true';
    const months = parseInt(searchParams.get('months') ?? '6', 10);

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    try {
        if (trend) {
            const trendData = await getComplianceTrend(session.user.id, months);
            return ok({ trend: trendData });
        }

        if (strategyId) {
            const metrics = await getComplianceByStrategy(session.user.id, strategyId);
            return ok(metrics);
        }

        const metrics = await getComplianceMetrics(session.user.id, {
            accountId: accountId ?? undefined,
            strategyId: strategyId ?? undefined,
            startDate: start,
            endDate: end,
        });

        return ok(metrics);
    } catch (error) {
        logger.error({ err: error }, '[compliance-analytics] Error');
        return internalError();
    }
});
