import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';

// GET /api/violations - List strategy violations
export async function GET(req: NextRequest) {
  return withAuth(req, async (session) => {
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get('strategyId');
    const accountId = searchParams.get('accountId');
    const ruleType = searchParams.get('ruleType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { userId: session.user.id };
    if (strategyId) where.strategyId = strategyId;
    if (accountId) where.accountId = accountId;
    if (ruleType) where.ruleType = ruleType;

    const violations = await prisma.strategyViolation.findMany({
      where,
      include: {
        strategy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.strategyViolation.count({ where });

    return NextResponse.json({ violations, total });
  });
}
