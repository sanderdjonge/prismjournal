import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAdmin } from '@/lib/api/withAdmin';

export const GET = withAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  const page    = Math.max(1, parseInt(searchParams.get('page')  || '1') || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
  const action  = searchParams.get('action') || '';   // filter by action type
  const userId  = searchParams.get('userId') || '';   // filter by user id
  const search  = searchParams.get('search') || '';   // search IP or details text

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (search) {
    where.OR = [
      { ipAddress: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve user emails separately (userId is optional and not a FK relation)
  const userIds = [...new Set(entries.map(e => e.userId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  // Distinct action types for the filter dropdown
  const actionTypes = await prisma.auditLog.groupBy({
    by: ['action'],
    orderBy: { action: 'asc' },
  });

  const rows = entries.map(e => ({
    id: e.id,
    action: e.action,
    details: e.details,
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    userId: e.userId,
    userEmail: e.userId ? (userMap[e.userId]?.email ?? null) : null,
    userName: e.userId ? (userMap[e.userId]?.name ?? null) : null,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({
    entries: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    actionTypes: actionTypes.map(a => a.action),
  });
});
