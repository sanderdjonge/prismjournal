import prisma from '@/lib/prisma'
import { calculateProfitFactor, serializeProfitFactor, calculateMaxDrawdownFromBalance } from '@/lib/analytics'
import { formatPercent } from '@/lib/formatNumber'
import { formatDateKey } from '@/lib/formatTime'
import type { WeeklyDigestData } from '@/lib/email'

export type DigestData = Omit<WeeklyDigestData, 'email' | 'dashboardUrl'>

export async function computeWeeklyDigestData(accountId: string, userId: string): Promise<DigestData> {
  const now = new Date()

  const weekEnd = new Date(now)
  weekEnd.setHours(23, 59, 59, 999)

  const weekStart = new Date(now)
  const dayOfWeek = weekStart.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  weekStart.setDate(weekStart.getDate() - diff)
  weekStart.setHours(0, 0, 0, 0)

  const prevWeekEnd = new Date(weekStart)
  prevWeekEnd.setTime(prevWeekEnd.getTime() - 1)

  const prevWeekStart = new Date(prevWeekEnd)
  prevWeekStart.setDate(prevWeekStart.getDate() - 6)
  prevWeekStart.setHours(0, 0, 0, 0)

  const trades = await prisma.trade.findMany({
    where: {
      accountId,
      exitTime: {
        gte: weekStart,
        lte: weekEnd,
      },
      pnl: { not: null },
    },
    orderBy: { exitTime: 'asc' },
  })

  const prevWeekTrades = await prisma.trade.findMany({
    where: {
      accountId,
      exitTime: {
        gte: prevWeekStart,
        lte: prevWeekEnd,
      },
      pnl: { not: null },
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  const latestSnapshot = await prisma.equitySnapshot.findFirst({
    where: { accountId },
    orderBy: { timestamp: 'desc' },
  })

  const totalTrades = trades.length
  const wins = trades.filter(t => (t.pnl || 0) > 0)
  const losses = trades.filter(t => (t.pnl || 0) < 0)
  const winCount = wins.length
  const lossCount = losses.length

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0

  const prevWinCount = prevWeekTrades.filter(t => (t.pnl || 0) > 0).length
  const prevWinRate = prevWeekTrades.length > 0
    ? (prevWinCount / prevWeekTrades.length) * 100
    : null
  const winRateChange = prevWinRate !== null ? winRate - prevWinRate : null

  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0))
  const profitFactor = calculateProfitFactor(grossProfit, grossLoss)

  const tradesWithR = trades.filter(t => t.rMultiple !== null)
  const avgRR = tradesWithR.length > 0
    ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / tradesWithR.length
    : 0

  const accountBalance = latestSnapshot?.equity || latestSnapshot?.balance || 10000
  const returnOnEquity = (totalPnl / accountBalance) * 100

  const dailyPnlMap = new Map<string, number>()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  trades.forEach(trade => {
    if (trade.exitTime) {
      const dayKey = formatDateKey(trade.exitTime)
      dailyPnlMap.set(dayKey, (dailyPnlMap.get(dayKey) || 0) + (trade.pnl || 0))
    }
  })

  const dailyPnl = Array.from(dailyPnlMap.entries())
    .map(([date, pnl]) => ({
      day: dayNames[new Date(date).getDay()],
      pnl,
    }))
    .sort((a, b) => {
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
    })

  const instrumentMap = new Map<string, { trades: number; wins: number; pnl: number; originalSymbol: string }>()
  trades.forEach(trade => {
    const normalizedSymbol = trade.symbol.toUpperCase()
    const current = instrumentMap.get(normalizedSymbol) || { trades: 0, wins: 0, pnl: 0, originalSymbol: trade.symbol }
    current.trades++
    current.pnl += trade.pnl || 0
    if ((trade.pnl || 0) > 0) current.wins++
    instrumentMap.set(normalizedSymbol, current)
  })

  const topInstruments = Array.from(instrumentMap.entries())
    .map(([, data]) => ({
      symbol: data.originalSymbol,
      trades: data.trades,
      winRate: (data.wins / data.trades) * 100,
      pnl: data.pnl,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5)

  const pnlValues = trades.map(t => t.pnl || 0)
  const maxDrawdown = calculateMaxDrawdownFromBalance(pnlValues, accountBalance)
  const largestWin = Math.max(0, ...pnlValues)
  const largestLoss = Math.min(0, ...pnlValues)
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length) : 0

  return {
    userName: user?.name || undefined,
    weekStart,
    weekEnd,
    totalPnl,
    returnOnEquity,
    totalTrades,
    winCount,
    lossCount,
    winRate,
    winRateChange,
    profitFactor: serializeProfitFactor(profitFactor) ?? 0,
    avgRR,
    dailyPnl,
    topInstruments,
    maxDrawdown,
    largestWin,
    largestLoss,
    avgWin,
    avgLoss,
    accountBalance,
  }
}

export function formatTelegramDigest(data: DigestData): string {
  const pnlEmoji = data.totalPnl >= 0 ? '🟢' : '🔴'
  const pnlSign = data.totalPnl >= 0 ? '+' : ''

  let message = `<b>📊 Weekly Digest</b>\n\n`

  message += `${pnlEmoji} <b>Net P&L: ${pnlSign}$${data.totalPnl.toFixed(2)}</b>\n`
  message += `📈 Return: ${formatPercent(data.returnOnEquity, 2)}\n\n`

  message += `<b>Trade Stats</b>\n`
  message += `• Total Trades: ${data.totalTrades}\n`
  message += `• Win Rate: ${formatPercent(data.winRate, 1)}`
  if (data.winRateChange !== null) {
    const changeEmoji = data.winRateChange >= 0 ? '📈' : '📉'
    message += ` ${changeEmoji} ${data.winRateChange >= 0 ? '+' : ''}${formatPercent(data.winRateChange, 1)}`
  }
  message += `\n`
  message += `• Profit Factor: ${data.profitFactor.toFixed(2)}\n`
  message += `• Avg R:R: ${data.avgRR.toFixed(2)}R\n\n`

  message += `<b>Best & Worst</b>\n`
  message += `• Largest Win: $${data.largestWin.toFixed(2)}\n`
  message += `• Largest Loss: $${data.largestLoss.toFixed(2)}\n`

  return message
}
