import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';

// GET /api/violations - List violations for the current user
export const GET = withAuth(async (req: NextRequest, _ctx, session) => {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || undefined;
  const strategyId = searchParams.get('strategyId') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const where: Record<string, unknown> = {
    userId: session.user.id,
  };

  if (accountId) {
    where.accountId = accountId;
  }

  if (strategyId) {
    where.strategyId = strategyId;
  }

  const violations = await prisma.strategyViolation.findMany({
    where,
    include: {
      strategy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.strategyViolation.count({ where });

  return NextResponse.json({
    violations,
    pagination: {
      total,
      limit,
      offset,
    },
  });
});
