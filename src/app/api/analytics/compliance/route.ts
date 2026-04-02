/**
 * Compliance Analytics API
 *
 * GET /api/analytics/compliance
 * Returns checklist completion correlation with trade outcomes
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { badRequest, ok } from '@/lib/api/responses';
import { getComplianceMetrics, getComplianceByStrategy, getComplianceTrend } from '@/lib/services/compliance-analytics.service';

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
    const { searchParams } = new URL(req.url);
    
    const accountId = searchParams.get('accountId');
    const strategyId = searchParams.get('strategyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const trend = searchParams.get('trend') === 'true';
    const months = parseInt(searchParams.get('months') ?? '6', 10);

    // Parse dates if provided
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    try {
        if (trend) {
            // Return trend data over multiple months
            const trendData = await getComplianceTrend(session.user.id, months);
            return ok({ trend: trendData });
        }

        if (strategyId) {
            // Get metrics for specific strategy
            const metrics = await getComplianceByStrategy(session.user.id, strategyId);
            return ok(metrics);
        }

        // Get overall compliance metrics
        const metrics = await getComplianceMetrics(session.user.id, {
            accountId: accountId ?? undefined,
            strategyId: strategyId ?? undefined,
            startDate: start,
            endDate: end,
        });

        return ok(metrics);
    } catch (error) {
        console.error('[compliance-analytics] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch compliance analytics' },
            { status: 500 }
        );
    }
});
