import { StrategyRuleType } from '@prisma/client';
import prisma from '@/lib/prisma';

// ============================================
// Types
// ============================================

export interface TiltmeterScore {
  score: number; // 0-100 (0 = zen, 100 = full tilt)
  components: Record<string, { count: number; weightedScore: number }>;
  totalViolations: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface TiltmeterHistory {
  snapshots: Array<{
    date: Date;
    score: number;
    violationCount: number;
  }>;
}

// ============================================
// Rule Type Weights (severity)
// ============================================

const RULE_TYPE_WEIGHTS: Record<StrategyRuleType, number> = {
  MAX_DAILY_LOSS: 2.0,        // Very serious - financial risk
  MAX_DAILY_TRADES: 0.5,      // Moderate - impulse control
  MIN_RR_RATIO: 0.8,          // Moderate - setup quality
  ALLOWED_TIME_WINDOWS: 0.4,  // Minor - discipline
  ALLOWED_SYMBOLS: 0.4,       // Minor - focus
  MAX_POSITION_SIZE: 1.5,     // Serious - risk management
  NO_OVERTRADING: 1.0,        // Moderate - emotional control
  MANDATORY_STOP_LOSS: 1.5,   // Serious - risk management
  MAX_HOLDING_TIME: 0.3,      // Minor - strategy adherence
  MIN_HOLDING_TIME: 0.3,      // Minor - impulse control
};

// ============================================
// Main Tiltmeter Calculation
// ============================================

export async function calculateTiltmeter(
  userId: string,
  accountId?: string,
  periodDays: number = 30,
  persist: boolean = false
): Promise<TiltmeterScore> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Fetch violations for the period
  const where: any = {
    userId,
    occurredAt: { gte: periodStart, lte: periodEnd },
  };
  if (accountId) where.accountId = accountId;

  const violations = await prisma.strategyViolation.findMany({
    where,
    select: {
      ruleType: true,
      occurredAt: true,
      pnlImpact: true,
    },
  });

  // Calculate component scores
  const components: Record<string, { count: number; weightedScore: number }> = {};
  let totalWeightedScore = 0;

  // Group violations by type
  const byType = violations.reduce((acc, v) => {
    const type = v.ruleType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(v);
    return acc;
  }, {} as Record<string, typeof violations>);

  // Calculate score for each type
  for (const [type, typeViolations] of Object.entries(byType)) {
    const ruleType = type as StrategyRuleType;
    const weight = RULE_TYPE_WEIGHTS[ruleType] || 1.0;
    const count = typeViolations.length;

    // Recency multiplier: more recent = higher impact
    const now = Date.now();
    const recencyMultiplier = typeViolations.reduce((sum, v) => {
      const age = now - v.occurredAt.getTime();
      const ageInDays = age / (24 * 60 * 60 * 1000);
      const recency = Math.max(0.1, 1 - ageInDays / periodDays);
      return sum + recency;
    }, 0);

    const weightedScore = count * weight * recencyMultiplier;
    components[type] = { count, weightedScore };
    totalWeightedScore += weightedScore;
  }

  // Final score (0-100 scale)
  // Formula: score = min(100, weightedSum * scale)
  const scale = 10; // Adjust this to calibrate the sensitivity
  const score = Math.min(100, Math.round(totalWeightedScore * scale));

  // Save snapshot
  if (persist) {
    await prisma.tiltmeterSnapshot.create({
      data: {
        userId,
        accountId: accountId || null,
        score,
        components,
        periodStart,
        periodEnd,
      },
    });
  }

  return {
    score,
    components,
    totalViolations: violations.length,
    periodStart,
    periodEnd,
  };
}

// ============================================
// Historical Scores
// ============================================

export async function getTiltmeterHistory(
  userId: string,
  accountId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<TiltmeterHistory> {
  // Set default date range if not provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  // First check if we have any snapshots
  const snapshotCount = await prisma.tiltmeterSnapshot.count({
    where: { userId }
  });

  // If no snapshots exist, calculate from violations directly
  if (snapshotCount === 0) {
    // Get violations grouped by date
    const where: any = {
      userId,
      occurredAt: { gte: start, lte: end }
    };
    if (accountId) where.accountId = accountId;

    const violations = await prisma.strategyViolation.findMany({
      where,
      select: {
        occurredAt: true,
        ruleType: true,
      },
      orderBy: { occurredAt: 'asc' }
    });

    // Group violations by date and calculate daily scores
    const violationsByDate = new Map<string, { count: number; weightedScore: number }>();

    for (const v of violations) {
      const dateKey = v.occurredAt.toISOString().split('T')[0];
      const weight = RULE_TYPE_WEIGHTS[v.ruleType] || 1.0;
      
      const existing = violationsByDate.get(dateKey) || { count: 0, weightedScore: 0 };
      existing.count += 1;
      existing.weightedScore += weight;
      violationsByDate.set(dateKey, existing);
    }

    // Generate snapshots for each day in range
    const snapshots: Array<{ date: Date; score: number; violationCount: number }> = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayData = violationsByDate.get(dateKey);
      
      // Calculate cumulative score up to this date
      let cumulativeWeightedScore = 0;
      const lookbackStart = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      for (const [d, data] of violationsByDate.entries()) {
        if (d >= lookbackStart.toISOString().split('T')[0] && d <= dateKey) {
          // Apply recency decay
          const dayDiff = Math.floor((currentDate.getTime() - new Date(d).getTime()) / (24 * 60 * 60 * 1000));
          const recency = Math.max(0.1, 1 - dayDiff / 30);
          cumulativeWeightedScore += data.weightedScore * recency;
        }
      }
      
      const score = Math.min(100, Math.round(cumulativeWeightedScore * 10));
      
      snapshots.push({
        date: new Date(currentDate),
        score,
        violationCount: dayData?.count || 0,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { snapshots };
  }

  // Original logic for when snapshots exist
  const where: any = { userId };
  if (accountId) where.accountId = accountId;
  if (startDate || endDate) {
    where.periodStart = {};
    if (startDate) where.periodStart.gte = startDate;
    if (endDate) where.periodStart.lte = endDate;
  }

  const snapshots = await prisma.tiltmeterSnapshot.findMany({
    where,
    orderBy: { periodStart: 'asc' },
    select: {
      periodStart: true,
      score: true,
      components: true,
    },
  });

  return {
    snapshots: snapshots.map((s) => {
      const components = s.components as Record<string, { count: number }>;
      const violationCount = Object.values(components).reduce(
        (sum, c) => sum + c.count,
        0
      );
      return {
        date: s.periodStart,
        score: s.score,
        violationCount,
      };
    }),
  };
}

// ============================================
// Compliance Stats
// ============================================

export interface ComplianceStats {
  totalTrades: number;
  compliantTrades: number;
  violationCount: number;
  adherenceRate: number;
  pnlWithViolations: number;
  pnlWithoutViolations: number;
  costOfViolations: number;
  violationsByType: Record<string, number>;
}

export async function getComplianceStats(
  userId: string,
  accountId?: string,
  strategyId?: string,
  periodDays: number = 30
): Promise<ComplianceStats> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Build where clause
  const tradeWhere: any = {
    accountId: { in: await getAccountIds(userId, accountId) },
    exitTime: { gte: periodStart, lte: periodEnd },
    status: 'CLOSED',
  };
  if (strategyId) tradeWhere.strategyId = strategyId;

  // Get violations
  const violationWhere: any = {
    userId,
    occurredAt: { gte: periodStart, lte: periodEnd },
  };
  if (accountId) violationWhere.accountId = accountId;
  if (strategyId) violationWhere.strategyId = strategyId;

  const violations = await prisma.strategyViolation.findMany({
    where: violationWhere,
    select: {
      tradeId: true,
      ruleType: true,
      pnlImpact: true,
    },
  });

  // Calculate stats
  const tradesWithViolations = new Set(violations.map((v) => v.tradeId));
  const totalViolations = violations.length;

  // Count violations by type
  const violationsByType: Record<string, number> = {};
  for (const v of violations) {
    const type = v.ruleType;
    violationsByType[type] = (violationsByType[type] || 0) + 1;
  }

  // Calculate P&L impact
  const pnlWithViolations = violations.reduce(
    (sum, v) => sum + (v.pnlImpact || 0),
    0
  );

  // Get total closed trades for period
  const totalTrades = await prisma.trade.count({ where: tradeWhere });
  const compliantTrades = totalTrades - tradesWithViolations.size;

  // Estimate cost of violations (compare win rate with/without violations)
  const costOfViolations = Math.abs(pnlWithViolations);

  const adherenceRate = totalTrades > 0 
    ? Math.round((compliantTrades / totalTrades) * 100) 
    : 100;

  return {
    totalTrades,
    compliantTrades,
    violationCount: totalViolations,
    adherenceRate,
    pnlWithViolations,
    pnlWithoutViolations: 0, // Would need more complex query
    costOfViolations,
    violationsByType,
  };
}

// ============================================
// Helper Functions
// ============================================

async function getAccountIds(userId: string, accountId?: string): Promise<string[]> {
  if (accountId) return [accountId];
  
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  });
  
  return accounts.map((a) => a.id);
}

// ============================================
// Dollar Cost of Violations
// ============================================

export async function getDollarCostOfViolations(
  userId: string,
  periodDays: number = 30
): Promise<{ total: number; byStrategy: Record<string, number> }> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const violations = await prisma.strategyViolation.findMany({
    where: {
      userId,
      occurredAt: { gte: periodStart, lte: periodEnd },
    },
    select: {
      strategyId: true,
      pnlImpact: true,
      strategy: { select: { name: true } },
    },
  });

  const byStrategy: Record<string, number> = {};
  let total = 0;

  for (const v of violations) {
    const pnl = v.pnlImpact || 0;
    const strategyName = v.strategy?.name || 'Unknown';
    byStrategy[strategyName] = (byStrategy[strategyName] || 0) + pnl;
    total += pnl;
  }

  return { total, byStrategy };
}
