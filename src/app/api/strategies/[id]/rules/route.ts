import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, notFound, forbidden } from '@/lib/api/responses';
import { StrategyRulesConfigSchema, createDefaultRules } from '@/lib/validations/strategy-rules';

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true, rules: true },
  });

  if (!strategy) {
    return notFound('Strategy');
  }

  if (strategy.userId !== session.user.id) {
    return forbidden();
  }

  const rules = strategy.rules || createDefaultRules();
  
  return ok({ rules });
});

export const PATCH = withAuth(async (req: NextRequest, ctx, session) => {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const body = await req.json();

  const parseResult = StrategyRulesConfigSchema.safeParse(body);
  if (!parseResult.success) {
    return badRequest('Invalid rules configuration');
  }

  const rules = parseResult.data;

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!strategy) {
    return notFound('Strategy');
  }

  if (strategy.userId !== session.user.id) {
    return forbidden();
  }

  const updated = await prisma.strategy.update({
    where: { id },
    data: {
      rules: rules as any,
    },
    select: { id: true, name: true, rules: true },
  });

  return ok({ 
    message: 'Rules updated successfully',
    strategy: updated 
  });
});
