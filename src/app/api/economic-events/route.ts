import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { withAdmin } from '@/lib/api/withAdmin';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';

// Validation schema for creating/updating events
const eventSchema = z.object({
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    time: z.string().optional(),
    currency: z.string().min(1),
    impact: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    forecast: z.string().optional(),
    actual: z.string().optional(),
    previous: z.string().optional(),
    source: z.string().optional(),
    externalId: z.string().optional(),
});

// GET /api/economic-events - List events with filters
export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const currency = searchParams.get('currency');
    const currencies = searchParams.get('currencies')?.split(',') || null;
    const impact = searchParams.get('impact');

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
        where.date = {};
        if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    if (currencies) {
        where.currency = { in: currencies.map(c => c.toUpperCase()) };
    } else if (currency) {
        where.currency = currency.toUpperCase();
    }

    if (impact) {
        const validImpacts = ['LOW', 'MEDIUM', 'HIGH'];
        const upperImpact = impact.toUpperCase();
        if (!validImpacts.includes(upperImpact)) {
            return NextResponse.json({ error: 'Invalid impact value' }, { status: 400 });
        }
        where.impact = upperImpact;
    }

    const events = await prisma.economicEvent.findMany({        where,
        orderBy: { date: 'asc' },
        take: 100,
    });

    return NextResponse.json({ events });
});

// POST /api/economic-events - Create event (admin only)
export const POST = withAdmin(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string; isSuperuser: boolean } }
) => {
    const body = await request.json();
    const validated = eventSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: validated.error.flatten() },
            { status: 400 }
        );
    }

    const data = validated.data;

    // Check for duplicate by externalId if provided
    if (data.externalId) {
        const existing = await prisma.economicEvent.findUnique({
            where: { externalId: data.externalId },
        });
        if (existing) {
            return NextResponse.json(existing, { status: 200 }); // Already exists, return it
        }
    }

    const event = await prisma.economicEvent.create({
        data: {
            name: data.name,
            date: new Date(data.date),
            time: data.time,
            currency: data.currency.toUpperCase(),
            impact: data.impact,
            forecast: data.forecast,
            actual: data.actual,
            previous: data.previous,
            source: data.source,
            externalId: data.externalId,
        },
    });

    return NextResponse.json(event, { status: 201 });
});