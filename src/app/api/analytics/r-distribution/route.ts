/**
 * R-Multiple Distribution API
 *
 * GET /api/analytics/r-distribution
 * Returns R-multiple distribution buckets for histogram visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok } from '@/lib/api/responses';

interface Bucket {
    minR: number;
    maxR: number;
    label: string;
    count: number;
    pct: number;
}

function calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length);
}

function calculateMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 !== 0
        ? sortedValues[mid]
        : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    // Build where clause
    const whereClause: Record<string, unknown> = {
        account: { userId: session.user.id },
        status: 'CLOSED',
        exitTime: { not: null },
        rMultiple: { not: null },
    };

    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    // Fetch R-multiples
    const trades = await prisma.trade.findMany({
        where: whereClause,
        select: {
            rMultiple: true,
        },
    });

    const rMultiples = trades
        .map(t => t.rMultiple)
        .filter((r): r is number => r !== null);

    if (rMultiples.length === 0) {
        return ok({
            buckets: [],
            stats: {
                mean: 0,
                median: 0,
                stdDev: 0,
                min: 0,
                max: 0,
                positiveCount: 0,
                negativeCount: 0,
                zeroCount: 0,
            },
        });
    }

    // Calculate stats
    const sortedR = [...rMultiples].sort((a, b) => a - b);
    const mean = rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length;
    const median = calculateMedian(sortedR);
    const stdDev = calculateStdDev(rMultiples, mean);

    // Define bucket boundaries (1R intervals from -10R to +10R)
    const bucketSize = 1;
    const minBucket = -10;
    const maxBucket = 10;
    const buckets: Bucket[] = [];

    for (let bucketMin = minBucket; bucketMin < maxBucket; bucketMin += bucketSize) {
        const bucketMax = bucketMin + bucketSize;
        const count = rMultiples.filter(r => r >= bucketMin && r < bucketMax).length;
        
        // Create label
        let label: string;
        if (bucketMin === -10) {
            label = '<-9R';
        } else if (bucketMax === 10) {
            label = '≥9R';
        } else {
            label = `${bucketMin}R to ${bucketMax}R`;
        }

        buckets.push({
            minR: bucketMin,
            maxR: bucketMax,
            label,
            count,
            pct: (count / rMultiples.length) * 100,
        });
    }

    return ok({
        buckets,
        stats: {
            mean,
            median,
            stdDev,
            min: sortedR[0],
            max: sortedR[sortedR.length - 1],
            positiveCount: rMultiples.filter(r => r > 0).length,
            negativeCount: rMultiples.filter(r => r < 0).length,
            zeroCount: rMultiples.filter(r => r === 0).length,
        },
    });
});