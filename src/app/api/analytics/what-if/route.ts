import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { runWhatIfSimulation, runMultipleScenarios, WhatIfFilters } from '@/lib/services/what-if.service';

const whatIfSchema = z.object({
    excludeDays: z.array(z.number().min(0).max(6)).optional(),
    excludeHours: z.array(z.number().min(0).max(23)).optional(),
    minRR: z.number().optional(),
    maxRR: z.number().optional(),
    minProfit: z.number().optional(),
    maxProfit: z.number().optional(),
    symbols: z.array(z.string()).optional(),
    stopLossMultiplier: z.number().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    accountIds: z.array(z.string()).optional(),
    direction: z.enum(['LONG', 'SHORT']).optional(),
});

const multiScenarioSchema = z.object({
    scenarios: z.array(whatIfSchema).min(1).max(3),
});

// GET /api/analytics/what-if - Run single scenario
export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    
    // Parse filters from query params
    const filters: WhatIfFilters = {};
    
    if (searchParams.get('excludeDays')) {
        filters.excludeDays = searchParams.get('excludeDays')!.split(',').map(Number);
    }
    if (searchParams.get('excludeHours')) {
        filters.excludeHours = searchParams.get('excludeHours')!.split(',').map(Number);
    }
    if (searchParams.get('minRR')) {
        filters.minRR = parseFloat(searchParams.get('minRR')!);
    }
    if (searchParams.get('maxRR')) {
        filters.maxRR = parseFloat(searchParams.get('maxRR')!);
    }
    if (searchParams.get('minProfit')) {
        filters.minProfit = parseFloat(searchParams.get('minProfit')!);
    }
    if (searchParams.get('maxProfit')) {
        filters.maxProfit = parseFloat(searchParams.get('maxProfit')!);
    }
    if (searchParams.get('symbols')) {
        filters.symbols = searchParams.get('symbols')!.split(',');
    }
    if (searchParams.get('stopLossMultiplier')) {
        filters.stopLossMultiplier = parseFloat(searchParams.get('stopLossMultiplier')!);
    }
    if (searchParams.get('startDate')) {
        filters.startDate = new Date(searchParams.get('startDate')!);
    }
    if (searchParams.get('endDate')) {
        filters.endDate = new Date(searchParams.get('endDate')!);
    }
    if (searchParams.get('accountIds')) {
        filters.accountIds = searchParams.get('accountIds')!.split(',');
    }
    if (searchParams.get('direction')) {
        filters.direction = searchParams.get('direction') as 'LONG' | 'SHORT';
    }

    try {
        const result = await runWhatIfSimulation(session.user.id, filters);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[what-if] Error running simulation:', error);
        return NextResponse.json(
            { error: 'Failed to run simulation' },
            { status: 500 }
        );
    }
});

// POST /api/analytics/what-if - Run multiple scenarios
export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    try {
        const body = await request.json();
        const validated = multiScenarioSchema.safeParse(body);

        if (!validated.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validated.error.flatten() },
                { status: 400 }
            );
        }

        const { scenarios } = validated.data;

        // Convert date strings to Date objects
        const parsedScenarios = scenarios.map(s => ({
            ...s,
            startDate: s.startDate ? new Date(s.startDate) : undefined,
            endDate: s.endDate ? new Date(s.endDate) : undefined,
        })) as WhatIfFilters[];

        const results = await runMultipleScenarios(session.user.id, parsedScenarios);
        return NextResponse.json(results);
    } catch (error) {
        console.error('[what-if] Error running multi-scenario:', error);
        return NextResponse.json(
            { error: 'Failed to run scenarios' },
            { status: 500 }
        );
    }
});