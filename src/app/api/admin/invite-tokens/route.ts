import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { withAdmin } from '@/lib/api/withAdmin';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import type { AdminSession } from '@/lib/api/withAdmin';
import { z } from 'zod';

const generateTokensSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  expiresDays: z.number().int().positive().optional(),
  email: z.string().email().optional(),
});

async function generateTokens(userId: string, count: number = 1, expiresDays?: number, email?: string) {
  const tokens: string[] = [];
  const records = [];

  for (let i = 0; i < count; i++) {
    const token = randomBytes(16).toString('hex');
    tokens.push(token);
    records.push({
      token,
      email: email || null,
      expiresAt: expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null,
      createdBy: userId,
    });
  }

  return { tokens, records };
}

export const POST = withAdmin(async (req: NextRequest, _ctx: Record<string, unknown>, session: AdminSession) => {
  try {
    const body = await req.json();
    const parsed = generateTokensSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid input: ' + parsed.error.issues.map(i => i.message).join(', '));
    }
    const { count, expiresDays, email } = parsed.data;

    const userId = session.user.id;
    const { tokens, records } = await generateTokens(userId, count, expiresDays, email);

    // Create tokens in database
    await prisma.inviteToken.createMany({
      data: records,
    });

    return ok({ tokens, count: tokens.length });
  } catch (error) {
    console.error('Error generating invite tokens:', error);
    return internalError();
  }
});

export const GET = withAdmin(async (req: NextRequest, _ctx: Record<string, unknown>, _session: AdminSession) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      prisma.inviteToken.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.inviteToken.count(),
    ]);

    return ok({
      tokens,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching invite tokens:', error);
    return internalError();
  }
});

export const DELETE = withAdmin(async (req: NextRequest, _ctx: Record<string, unknown>, _session: AdminSession) => {
  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return badRequest('Token ID is required');
    }

    let deleted;
    try {
      deleted = await prisma.inviteToken.delete({
        where: { id: tokenId },
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
        return badRequest('Token not found');
      }
      console.error('Error deleting invite token:', error);
      return internalError();
    }

    if (!deleted) {
      return badRequest('Token not found');
    }

    return ok({ deleted: true });
  } catch (error) {
    console.error('Error deleting invite token:', error);
    return internalError();
  }
});
