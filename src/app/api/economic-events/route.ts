import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { withAdmin } from '@/lib/api/withAdmin';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, created, badRequest } from '@/lib/api/responses';

const eventSchema = z.object({
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().optional(),
    currency: z.string().min(1),
    impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    forecast: z.string().optional(),
    actual: z.string().optional(),
    previous: z.string().optional(),
    source: z.string().optional(),
    externalId: z.string().optional(),
});

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
            return badRequest('Invalid impact value');
        }
        where.impact = upperImpact;
    }

    const events = await prisma.economicEvent.findMany({        where,
        orderBy: { date: 'asc' },
        take: 100,
    });

    return ok({ events });
});

export const POST = withAdmin(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string; isSuperuser: boolean } }
) => {
    const validation = await validateBody(request, eventSchema);
    if (!validation.success) return validation.response;
    const data = validation.data;

    if (data.externalId) {
        const existing = await prisma.economicEvent.findUnique({
            where: { externalId: data.externalId },
        });
        if (existing) {
            return ok(existing);
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

    return created(event);
});
