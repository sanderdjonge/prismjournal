import { PrismaClient, StrategyRuleType } from '@prisma/client';
import {
  StrategyRulesConfig,
  StrategyRule,
  validateRules,
  getEnabledRules,
} from '../validations/strategy-rules';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

export interface TradeContext {
  id: string;
  accountId: string;
  userId: string;
  strategyId?: string | null;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  volume: number;
  entryTime: Date;
  exitTime?: Date | null;
  pnl?: number | null;
  initialStopLoss?: number | null;
}

export interface ViolationResult {
  ruleId: string;
  ruleType: StrategyRuleType;
  limitValue: number;
  actualValue: number;
  pnlImpact?: number;
  description: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ViolationResult[];
  adherenceScore: number;
}

// ============================================
// Main Compliance Evaluator
// ============================================

export async function evaluateTradeCompliance(
  trade: TradeContext,
  strategyId: string
): Promise<ComplianceResult> {
  const strategy = await prisma.strategy.findUnique({
    where: { id: strategyId },
  });

  if (!strategy || !strategy.rules) {
    return { isCompliant: true, violations: [], adherenceScore: 100 };
  }

  const config = validateRules(strategy.rules);
  if (!config) {
    console.error('Invalid strategy rules configuration');
    return { isCompliant: true, violations: [], adherenceScore: 100 };
  }

  const enabledRules = getEnabledRules(config);
  const violations: ViolationResult[] = [];

  for (const rule of enabledRules) {
    const violation = await evaluateRule(rule, trade);
    if (violation) {
      violations.push(violation);
    }
  }

  const adherenceScore = calculateAdherenceScore(enabledRules.length, violations.length);

  return {
    isCompliant: violations.length === 0,
    violations,
    adherenceScore,
  };
}

// ============================================
// Individual Rule Evaluators
// ============================================

async function evaluateRule(
  rule: StrategyRule,
  trade: TradeContext
): Promise<ViolationResult | null> {
  switch (rule.type) {
    case 'MAX_DAILY_LOSS':
      return evaluateMaxDailyLoss(rule, trade);
    case 'MAX_DAILY_TRADES':
      return evaluateMaxDailyTrades(rule, trade);
    case 'MIN_RR_RATIO':
      return evaluateMinRRRatio(rule, trade);
    case 'ALLOWED_TIME_WINDOWS':
      return evaluateAllowedTimeWindows(rule, trade);
    case 'ALLOWED_SYMBOLS':
      return evaluateAllowedSymbols(rule, trade);
    case 'MAX_POSITION_SIZE':
      return evaluateMaxPositionSize(rule, trade);
    case 'NO_OVERTRADING':
      return evaluateNoOvertrading(rule, trade);
    case 'MANDATORY_STOP_LOSS':
      return evaluateMandatoryStopLoss(rule, trade);
    case 'MAX_HOLDING_TIME':
      return evaluateMaxHoldingTime(rule, trade);
    case 'MIN_HOLDING_TIME':
      return evaluateMinHoldingTime(rule, trade);
    default:
      return null;
  }
}

async function evaluateMaxDailyLoss(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTrades = await prisma.trade.findMany({
    where: {
      accountId: trade.accountId,
      exitTime: { gte: today },
      status: 'CLOSED',
    },
    select: { pnl: true },
  });

  const todayPnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const tradePnl = trade.pnl || 0;
  const totalPnl = todayPnl + tradePnl;

  let limitValue = rule.limit;
  let actualValue = totalPnl;

  if (rule.isPercentage) {
    const account = await prisma.tradingAccount.findUnique({
      where: { id: trade.accountId },
      select: { balance: true },
    });
    const balance = account?.balance || 10000;
    limitValue = (rule.limit / 100) * balance;
  }

  if (totalPnl < -limitValue) {
    return {
      ruleId: rule.id,
      ruleType: 'MAX_DAILY_LOSS',
      limitValue: -limitValue,
      actualValue,
      pnlImpact: tradePnl,
      description: `Daily loss limit exceeded: ${actualValue.toFixed(2)} vs limit ${(-limitValue).toFixed(2)}`,
    };
  }

  return null;
}

async function evaluateMaxDailyTrades(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTradeCount = await prisma.trade.count({
    where: {
      accountId: trade.accountId,
      entryTime: { gte: today },
    },
  });

  if (todayTradeCount >= rule.limit) {
    return {
      ruleId: rule.id,
      ruleType: 'MAX_DAILY_TRADES',
      limitValue: rule.limit,
      actualValue: todayTradeCount + 1,
      description: `Max daily trades exceeded: ${todayTradeCount + 1} vs limit ${rule.limit}`,
    };
  }

  return null;
}

async function evaluateMinRRRatio(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  if (!trade.stopLoss && !trade.initialStopLoss) {
    return null;
  }

  const sl = trade.initialStopLoss || trade.stopLoss;
  if (!sl) return null;

  const risk = Math.abs(trade.entryPrice - sl);
  if (risk === 0) return null;

  let reward = 0;
  if (trade.takeProfit) {
    reward = Math.abs(trade.takeProfit - trade.entryPrice);
  } else if (trade.exitPrice) {
    reward = Math.abs(trade.exitPrice - trade.entryPrice);
  }

  const rrRatio = reward / risk;

  if (rrRatio < rule.limit) {
    return {
      ruleId: rule.id,
      ruleType: 'MIN_RR_RATIO',
      limitValue: rule.limit,
      actualValue: rrRatio,
      pnlImpact: trade.pnl,
      description: `R:R ratio below minimum: ${rrRatio.toFixed(2)} vs required ${rule.limit}`,
    };
  }

  return null;
}

async function evaluateAllowedTimeWindows(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  const entryTime = new Date(trade.entryTime);
  const timezone = rule.timezone || 'UTC';
  const localTime = new Date(entryTime.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = localTime.getDay();
  const hours = localTime.getHours().toString().padStart(2, '0');
  const minutes = localTime.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  let isWithinWindow = false;
  for (const window of rule.windows) {
    if (window.days && !window.days.includes(dayOfWeek)) {
      continue;
    }
    if (timeStr >= window.start && timeStr <= window.end) {
      isWithinWindow = true;
      break;
    }
  }

  if (!isWithinWindow) {
    return {
      ruleId: rule.id,
      ruleType: 'ALLOWED_TIME_WINDOWS',
      limitValue: 1,
      actualValue: 0,
      description: `Trade opened outside allowed time windows at ${timeStr}`,
    };
  }

  return null;
}

async function evaluateAllowedSymbols(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  const symbolAllowed = rule.mode === 'ALLOW'
    ? rule.symbols.includes(trade.symbol)
    : !rule.symbols.includes(trade.symbol);

  if (!symbolAllowed) {
    return {
      ruleId: rule.id,
      ruleType: 'ALLOWED_SYMBOLS',
      limitValue: 1,
      actualValue: 0,
      description: `Symbol ${trade.symbol} is ${rule.mode === 'ALLOW' ? 'not allowed' : 'blocked'}`,
    };
  }

  return null;
}

async function evaluateMaxPositionSize(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  if (trade.volume > rule.limit) {
    return {
      ruleId: rule.id,
      ruleType: 'MAX_POSITION_SIZE',
      limitValue: rule.limit,
      actualValue: trade.volume,
      description: `Position size ${trade.volume} exceeds limit ${rule.limit}`,
    };
  }
  return null;
}

async function evaluateNoOvertrading(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  const oneHourAgo = new Date(trade.entryTime.getTime() - 60 * 60 * 1000);
  const recentTrades = await prisma.trade.count({
    where: {
      accountId: trade.accountId,
      entryTime: { gte: oneHourAgo },
    },
  });

  if (recentTrades >= rule.maxTradesPerHour) {
    return {
      ruleId: rule.id,
      ruleType: 'NO_OVERTRADING',
      limitValue: rule.maxTradesPerHour,
      actualValue: recentTrades + 1,
      description: `Overtrading: ${recentTrades + 1} trades in last hour vs limit ${rule.maxTradesPerHour}`,
    };
  }
  return null;
}

async function evaluateMandatoryStopLoss(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  if (!trade.stopLoss && !trade.initialStopLoss) {
    return {
      ruleId: rule.id,
      ruleType: 'MANDATORY_STOP_LOSS',
      limitValue: 1,
      actualValue: 0,
      description: 'Trade opened without stop loss',
    };
  }
  return null;
}

async function evaluateMaxHoldingTime(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  if (!trade.exitTime) return null;
  const holdingMinutes = (trade.exitTime.getTime() - trade.entryTime.getTime()) / (1000 * 60);

  if (holdingMinutes > rule.maxMinutes) {
    return {
      ruleId: rule.id,
      ruleType: 'MAX_HOLDING_TIME',
      limitValue: rule.maxMinutes,
      actualValue: holdingMinutes,
      pnlImpact: trade.pnl,
      description: `Holding time ${Math.round(holdingMinutes)}min exceeds max ${rule.maxMinutes}min`,
    };
  }
  return null;
}

async function evaluateMinHoldingTime(
  rule: any,
  trade: TradeContext
): Promise<ViolationResult | null> {
  if (!trade.exitTime) return null;
  const holdingMinutes = (trade.exitTime.getTime() - trade.entryTime.getTime()) / (1000 * 60);

  if (holdingMinutes < rule.minMinutes) {
    return {
      ruleId: rule.id,
      ruleType: 'MIN_HOLDING_TIME',
      limitValue: rule.minMinutes,
      actualValue: holdingMinutes,
      pnlImpact: trade.pnl,
      description: `Holding time ${Math.round(holdingMinutes)}min below min ${rule.minMinutes}min`,
    };
  }
  return null;
}

// ============================================
// Helper Functions
// ============================================

function calculateAdherenceScore(totalRules: number, violations: number): number {
  if (totalRules === 0) return 100;
  const violationRatio = violations / totalRules;
  return Math.max(0, Math.round((1 - violationRatio) * 100));
}

// ============================================
// Violation Recording
// ============================================

export async function recordViolation(
  violation: ViolationResult,
  trade: TradeContext,
  strategyId: string
): Promise<void> {
  await prisma.strategyViolation.create({
    data: {
      strategyId,
      tradeId: trade.id,
      userId: trade.userId,
      accountId: trade.accountId,
      ruleId: violation.ruleId,
      ruleType: violation.ruleType,
      limitValue: violation.limitValue,
      actualValue: violation.actualValue,
      pnlImpact: violation.pnlImpact,
      occurredAt: new Date(),
    },
  });
}

export async function evaluateAndRecordCompliance(
  trade: TradeContext,
  strategyId: string
): Promise<ComplianceResult> {
  const result = await evaluateTradeCompliance(trade, strategyId);
  for (const violation of result.violations) {
    await recordViolation(violation, trade, strategyId);
  }
  return result;
}
