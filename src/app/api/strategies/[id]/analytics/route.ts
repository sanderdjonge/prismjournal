import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import prisma from '@/lib/prisma'
import type { Session } from 'next-auth'

interface AnalyticsResponse {
  winRate: number
  avgR: number
  profitFactor: number
  maxDrawdown: number
  bestTrade: { pnl: number; r: number | null; date: string } | null
  worstTrade: { pnl: number; r: number | null; date: string } | null
  totalPnl: number
  tradeCount: number
  expectancy: number
  equityCurve: Array<{ date: string; cumulative: number }>
  monthlyReturns: Array<{ month: number; year: number; pnl: number; returnPercent: number }>
  ruleBreakdown: Array<{
    ruleId: string
    ruleType: string
    violationCount: number
    violationPercent: number
    pnlImpact: number | null
  }>
  bySymbol: Array<{ symbol: string; winRate: number; pnl: number; count: number }>
  byDirection: {
    long: { winRate: number; pnl: number; avgR: number; count: number }
    short: { winRate: number; pnl: number; avgR: number; count: number }
  }
  byTimeOfDay: Array<{ period: string; winRate: number; pnl: number; count: number }>
  byDayOfWeek: Array<{ day: number; winRate: number; pnl: number; count: number }>
}

function getEmptyResponse(): AnalyticsResponse {
  return {
    winRate: 0,
    avgR: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    bestTrade: null,
    worstTrade: null,
    totalPnl: 0,
    tradeCount: 0,
    expectancy: 0,
    equityCurve: [],
    monthlyReturns: [],
    ruleBreakdown: [],
    bySymbol: [],
    byDirection: { long: { winRate: 0, pnl: 0, avgR: 0, count: 0 }, short: { winRate: 0, pnl: 0, avgR: 0, count: 0 } },
    byTimeOfDay: [],
    byDayOfWeek: [],
  }
}

export const GET = withAuth(async (
  req: NextRequest,
  _ctx: Record<string, unknown>,
  session: Session & { user: { id: string } }
) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const strategyId = pathParts[pathParts.length - 2]

  const strategy = await prisma.strategy.findFirst({
    where: { id: strategyId, userId: session.user.id },
  })

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
  }

  const trades = await prisma.trade.findMany({
    where: {
      strategyId,
      exitTime: { not: null },
    },
    select: {
      pnl: true,
      rMultiple: true,
      exitTime: true,
      symbol: true,
      direction: true,
      entryTime: true,
    },
    orderBy: { exitTime: 'asc' },
  })

  if (trades.length === 0) {
    return NextResponse.json(getEmptyResponse())
  }

  const wins = trades.filter(t => (t.pnl ?? 0) >= 0)
  const losses = trades.filter(t => (t.pnl ?? 0) < 0)
  const winRate = (wins.length / trades.length) * 100

  const rValues = trades.map(t => t.rMultiple).filter((r): r is number => r !== null)
  const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0

  const totalWins = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0

  let peak = 0
  let maxDd = 0
  let cumulative = 0
  for (const t of trades) {
    cumulative += t.pnl ?? 0
    if (cumulative > peak) peak = cumulative
    const dd = peak - cumulative
    if (dd > maxDd) maxDd = dd
  }
  const maxDrawdown = peak > 0 ? (maxDd / peak) * 100 : 0

  const sortedByPnl = [...trades].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
  const bestTrade = sortedByPnl[0] ? {
    pnl: sortedByPnl[0].pnl ?? 0,
    r: sortedByPnl[0].rMultiple,
    date: sortedByPnl[0].exitTime!.toISOString(),
  } : null
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] ? {
    pnl: sortedByPnl[sortedByPnl.length - 1].pnl ?? 0,
    r: sortedByPnl[sortedByPnl.length - 1].rMultiple,
    date: sortedByPnl[sortedByPnl.length - 1].exitTime!.toISOString(),
  } : null

  const equityCurve: Array<{ date: string; cumulative: number }> = []
  let runningPnl = 0
  for (const t of trades) {
    runningPnl += t.pnl ?? 0
    equityCurve.push({
      date: t.exitTime!.toISOString().split('T')[0],
      cumulative: runningPnl,
    })
  }

  const monthlyMap = new Map<string, { pnl: number; count: number }>()
  for (const t of trades) {
    const date = new Date(t.exitTime!)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const existing = monthlyMap.get(key) ?? { pnl: 0, count: 0 }
    existing.pnl += t.pnl ?? 0
    existing.count++
    monthlyMap.set(key, existing)
  }
  const monthlyReturns = Array.from(monthlyMap.entries()).map(([key, data]) => {
    const [year, month] = key.split('-').map(Number)
    const returnPercent = totalPnl !== 0 ? (data.pnl / Math.abs(totalPnl)) * 100 : 0
    return { month: month + 1, year, pnl: data.pnl, returnPercent }
  })

  const violations = await prisma.strategyViolation.groupBy({
    by: ['ruleId', 'ruleType'],
    where: { strategyId },
    _count: { id: true },
    _sum: { pnlImpact: true },
  })

  const ruleBreakdown = violations.map(v => ({
    ruleId: v.ruleId,
    ruleType: v.ruleType,
    violationCount: v._count.id,
    violationPercent: (v._count.id / trades.length) * 100,
    pnlImpact: v._sum.pnlImpact,
  }))

  const symbolMap = new Map<string, { pnl: number; wins: number; count: number }>()
  for (const t of trades) {
    const existing = symbolMap.get(t.symbol) ?? { pnl: 0, wins: 0, count: 0 }
    existing.pnl += t.pnl ?? 0
    if ((t.pnl ?? 0) >= 0) existing.wins++
    existing.count++
    symbolMap.set(t.symbol, existing)
  }
  const bySymbol = Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({
      symbol,
      winRate: (data.wins / data.count) * 100,
      pnl: data.pnl,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const longTrades = trades.filter(t => t.direction === 'LONG')
  const shortTrades = trades.filter(t => t.direction === 'SHORT')

  const byDirection = {
    long: {
      winRate: longTrades.length > 0 ? (longTrades.filter(t => (t.pnl ?? 0) >= 0).length / longTrades.length) * 100 : 0,
      pnl: longTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
      avgR: longTrades.length > 0 ? longTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / longTrades.length : 0,
      count: longTrades.length,
    },
    short: {
      winRate: shortTrades.length > 0 ? (shortTrades.filter(t => (t.pnl ?? 0) >= 0).length / shortTrades.length) * 100 : 0,
      pnl: shortTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
      avgR: shortTrades.length > 0 ? shortTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / shortTrades.length : 0,
      count: shortTrades.length,
    },
  }

  const timeMap = new Map<string, { pnl: number; wins: number; count: number }>()
  const timeLabels = ['Night', 'Morning', 'Afternoon', 'Evening']
  for (const t of trades) {
    const hour = new Date(t.entryTime).getHours()
    const period = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
    const existing = timeMap.get(period) ?? { pnl: 0, wins: 0, count: 0 }
    existing.pnl += t.pnl ?? 0
    if ((t.pnl ?? 0) >= 0) existing.wins++
    existing.count++
    timeMap.set(period, existing)
  }
  const byTimeOfDay = timeLabels.map(period => {
    const data = timeMap.get(period) ?? { pnl: 0, wins: 0, count: 0 }
    return {
      period,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      pnl: data.pnl,
      count: data.count,
    }
  })

  const dayMap = new Map<number, { pnl: number; wins: number; count: number }>()
  for (const t of trades) {
    const day = new Date(t.entryTime).getDay()
    const existing = dayMap.get(day) ?? { pnl: 0, wins: 0, count: 0 }
    existing.pnl += t.pnl ?? 0
    if ((t.pnl ?? 0) >= 0) existing.wins++
    existing.count++
    dayMap.set(day, existing)
  }
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]
  const byDayOfWeek = dayOrder.map(day => {
    const data = dayMap.get(day) ?? { pnl: 0, wins: 0, count: 0 }
    return {
      day,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      pnl: data.pnl,
      count: data.count,
    }
  })

  const response: AnalyticsResponse = {
    winRate,
    avgR,
    profitFactor,
    maxDrawdown,
    bestTrade,
    worstTrade,
    totalPnl,
    tradeCount: trades.length,
    expectancy,
    equityCurve,
    monthlyReturns,
    ruleBreakdown,
    bySymbol,
    byDirection,
    byTimeOfDay,
    byDayOfWeek,
  }

  return NextResponse.json(response)
})

export const runtime = 'nodejs'
