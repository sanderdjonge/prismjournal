import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { StrategyRulesConfigSchema, createDefaultRules } from '@/lib/validations/strategy-rules';

// GET /api/strategies/:id/rules - Get strategy rules configuration
export const GET = withAuth(async (req: NextRequest, ctx, session) => {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true, rules: true },
  });

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  if (strategy.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Return existing rules or default empty config
  const rules = strategy.rules || createDefaultRules();
  
  return NextResponse.json({ rules });
});

// PATCH /api/strategies/:id/rules - Update strategy rules configuration
export const PATCH = withAuth(async (req: NextRequest, ctx, session) => {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const body = await req.json();

  // Validate the rules configuration
  const parseResult = StrategyRulesConfigSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid rules configuration', details: parseResult.error.errors },
      { status: 400 }
    );
  }

  const rules = parseResult.data;

  // Verify strategy exists and belongs to user
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  if (strategy.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Update the rules
  const updated = await prisma.strategy.update({
    where: { id },
    data: {
      rules: rules as any,
    },
    select: { id: true, name: true, rules: true },
  });

  return NextResponse.json({ 
    message: 'Rules updated successfully',
    strategy: updated 
  });
});
