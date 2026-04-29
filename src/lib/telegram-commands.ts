import prisma from './prisma'
import { calculateProfitFactor, formatProfitFactor as canonicalFormatProfitFactor } from './analytics'
import { formatPercent } from '@/lib/formatNumber'
import { computePrismScore, computeWeeklyHistory } from '@/lib/services/prism-score.service'
import logger from '@/lib/logger'

export const PNL_PERIODS = ['today', 'week', 'month', 'all'] as const
export type PnlPeriod = typeof PNL_PERIODS[number]

export const PNL_HELP =
  `📊 <b>PrismJournal PnL</b>\n\n` +
  `Usage:\n` +
  `  /pnl today\n` +
  `  /pnl week\n` +
  `  /pnl month\n` +
  `  /pnl all`

export const VALID_MOODS = ['CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE'] as const
export type ValidMood = typeof VALID_MOODS[number]

const PERIOD_LABELS: Record<PnlPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

function getPeriodStart(period: PnlPeriod, now: Date): Date | null {
  if (period === 'all') return null
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  if (period === 'today') return new Date(Date.UTC(y, m, d))
  if (period === 'month') return new Date(Date.UTC(y, m, 1))
  const day = now.getUTCDay()
  const offset = (day + 6) % 7
  return new Date(Date.UTC(y, m, d - offset))
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatSign(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}

interface TradeLike {
  pnl: number | null
  rMultiple: number | null
  accountId: string
}

interface AccountSummary {
  totalPnl: number
  wins: number
  total: number
  grossProfits: number
  grossLosses: number
  rMultiples: number[]
}

function computeSummary(trades: TradeLike[], accountId?: string): AccountSummary {
  const filtered = accountId ? trades.filter(t => t.accountId === accountId) : trades
  let totalPnl = 0, wins = 0, total = 0, grossProfits = 0, grossLosses = 0
  const rMultiples: number[] = []
  for (const t of filtered) {
    if (t.pnl === null) continue
    total++
    totalPnl += t.pnl
    if (t.pnl > 0) { wins++; grossProfits += t.pnl }
    else if (t.pnl < 0) { grossLosses += Math.abs(t.pnl) }
    if (t.rMultiple !== null && t.rMultiple !== undefined) {
      rMultiples.push(t.rMultiple)
    }
  }
  return { totalPnl, wins, total, grossProfits, grossLosses, rMultiples }
}

function formatProfitFactor(s: AccountSummary): string {
  if (s.total === 0) return '0.00'
  return canonicalFormatProfitFactor(calculateProfitFactor(s.grossProfits, s.grossLosses))
}

function formatWinRate(s: AccountSummary): string {
  if (s.total === 0) return '0.0% (0/0)'
  const pct = ((s.wins / s.total) * 100).toFixed(1)
  return `${pct}% (${s.wins}/${s.total})`
}

function formatOverallPnl(s: AccountSummary, currencies: string[]): string {
  const allSame = currencies.length > 0 && currencies.every(c => c === currencies[0])
  if (allSame) return `${formatSign(s.totalPnl)} ${currencies[0]}`
  return `${formatSign(s.totalPnl)} (mixed currencies — see breakdown)`
}

const MAX_TELEGRAM_LEN = 4096

function truncateToTelegram(text: string): string {
  if (text.length <= MAX_TELEGRAM_LEN) return text
  return text.slice(0, MAX_TELEGRAM_LEN - 1) + '…'
}

async function findUserByChatId(chatId: string) {
  const config = await prisma.alertConfig.findFirst({
    where: { telegramId: chatId },
    include: {
      user: {
        include: {
          accounts: { select: { id: true, name: true, currency: true } },
        },
      },
    },
  })
  return config
}

export async function handlePnlCommand(chatId: string, period: PnlPeriod): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)

    if (!config) {
      return 'No PrismJournal account is linked to this Telegram ID.'
    }

    const accounts = config.user.accounts
    const accountIds = accounts.map(a => a.id)
    const now = new Date()
    const periodStart = getPeriodStart(period, now)

    const exitTimeFilter: { not: null; lte: Date; gte?: Date } = {
      not: null,
      lte: now,
      ...(periodStart ? { gte: periodStart } : {}),
    }

    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        status: 'CLOSED',
        exitTime: exitTimeFilter,
      },
      select: { pnl: true, rMultiple: true, accountId: true },
    })

    const overall = computeSummary(trades)
    if (overall.total === 0) {
      return 'No closed trades found for this period.'
    }

    const currencies = accounts.map(a => a.currency ?? 'USD')
    const header = `📊 <b>PnL Summary — ${PERIOD_LABELS[period]}</b>`
    const overallSection = [
      `Net PnL:       ${formatOverallPnl(overall, currencies)}`,
      `Win Rate:      ${formatWinRate(overall)}`,
      `Profit Factor: ${formatProfitFactor(overall)}`,
      ...(overall.rMultiples.length > 0
        ? [`Avg RR:        ${(overall.rMultiples.reduce((a, b) => a + b, 0) / overall.rMultiples.length).toFixed(1)}R`]
        : []),
    ].join('\n')

    let body = `${header}\n\n${overallSection}`

    if (accounts.length > 1) {
      const accountTrades = accounts
        .map(account => {
          const s = computeSummary(trades, account.id)
          if (s.total === 0) return null
          const safeName = escapeHtml(account.name ?? account.id)
          const currency = account.currency ?? ''
          return `${safeName} (${currency})\n  PnL: ${formatSign(s.totalPnl)} · WR: ${formatPercent((s.wins / s.total) * 100, 0)}`
        })
        .filter(Boolean)
        .join('\n\n')

      if (accountTrades) {
        const divider = '\n\n──────────────────\n'
        const candidate = body + divider + accountTrades
        if (candidate.length <= MAX_TELEGRAM_LEN) {
          body = candidate
        } else {
          const available = MAX_TELEGRAM_LEN - body.length - divider.length - 1
          body = body + divider + accountTrades.slice(0, available) + '…'
        }
      }
    }

    return truncateToTelegram(body)
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handlePnlCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleScoreCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const now = new Date()
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(now.getDate() - 90)

    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        exitTime: { gte: ninetyDaysAgo, lte: now, not: null },
        pnl: { not: null },
      },
      select: { pnl: true, exitTime: true, entryTime: true },
      orderBy: { exitTime: 'asc' },
    })

    const { score, components } = computePrismScore(trades)

    const allTrades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        exitTime: { not: null },
        pnl: { not: null },
      },
      select: { pnl: true, exitTime: true },
      orderBy: { exitTime: 'asc' },
    })

    const weeklyHistory = computeWeeklyHistory(allTrades)

    const pillarLabels: [string, number][] = [
      ['Risk Management', Math.round((components.maxDrawdown + components.recoveryFactor) / 2)],
      ['Discipline', Math.round((components.profitFactor + components.winLossRatio) / 2)],
      ['Consistency', Math.round((components.consistency + components.winRate) / 2)],
      ['Psychology', Math.round((components.recoveryFactor + components.consistency) / 2)],
    ]
    pillarLabels.sort((a, b) => a[1] - b[1])

    const trendArrow = (curr: number, prev: number): string => {
      if (curr > prev + 2) return '▲'
      if (curr < prev - 2) return '▼'
      return '─'
    }

    let trendLine = ''
    if (weeklyHistory.length >= 2) {
      const recent = weeklyHistory.slice(-12)
      const arrows = recent.map((w, i) => {
        if (i === 0) return '─'
        return trendArrow(w.score, recent[i - 1].score)
      })
      trendLine = `\n12w Trend:     ${arrows.join('')}`
    }

    const coachingTips: Record<string, string> = {
      'Risk Management': 'Focus on position sizing and drawdown control.',
      'Discipline': 'Stick to your plan — avoid impulsive entries and exits.',
      'Consistency': 'Aim for steady daily results rather than big swings.',
      'Psychology': 'Work on emotional regulation — log your mood before each trade.',
    }

    const weakest = pillarLabels[0]
    const tip = coachingTips[weakest[0]] ?? 'Keep journaling your trades for insights.'

    const lines = [
      `🏆 <b>Prism Score</b>`,
      ``,
      `Overall:       <b>${score}/100</b>`,
      trendLine,
      ``,
      `<b>Pillars:</b>`,
      ...pillarLabels.map(([name, val]) => {
        const bar = '█'.repeat(Math.round(val / 10)) + '░'.repeat(10 - Math.round(val / 10))
        return `${name}: <code>${bar}</code> ${val}`
      }),
      ``,
      `💡 <i>${tip}</i>`,
    ]

    return truncateToTelegram(lines.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleScoreCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleStatsCommand(chatId: string, symbol: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const upperSymbol = symbol.toUpperCase()
    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        symbol: { equals: upperSymbol, mode: 'insensitive' },
        status: 'CLOSED',
        pnl: { not: null },
        exitTime: { not: null },
      },
      select: {
        pnl: true,
        rMultiple: true,
        entryTime: true,
        exitTime: true,
        direction: true,
      },
      orderBy: { exitTime: 'desc' },
    })

    if (trades.length === 0) return `No closed trades found for <code>${escapeHtml(upperSymbol)}</code>.`

    let totalPnl = 0, wins = 0, grossProfit = 0, grossLoss = 0
    const rMultiples: number[] = []
    const holdTimesMs: number[] = []
    let bestPnl = -Infinity, worstPnl = Infinity
    let bestDir = '', worstDir = ''

    for (const t of trades) {
      if (t.pnl === null) continue
      totalPnl += t.pnl
      if (t.pnl > 0) { wins++; grossProfit += t.pnl }
      else if (t.pnl < 0) { grossLoss += Math.abs(t.pnl) }
      if (t.rMultiple !== null) rMultiples.push(t.rMultiple)
      if (t.entryTime && t.exitTime) {
        holdTimesMs.push(new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime())
      }
      if (t.pnl > bestPnl) { bestPnl = t.pnl; bestDir = t.direction }
      if (t.pnl < worstPnl) { worstPnl = t.pnl; worstDir = t.direction }
    }

    const total = trades.length
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : '0.0'
    const pf = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞'
    const avgRR = rMultiples.length > 0 ? (rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length).toFixed(1) : 'N/A'

    const avgHoldMs = holdTimesMs.length > 0 ? holdTimesMs.reduce((a, b) => a + b, 0) / holdTimesMs.length : 0
    const avgHoldHours = Math.round(avgHoldMs / 3600000)
    const avgHoldStr = avgHoldHours >= 24
      ? `${Math.floor(avgHoldHours / 24)}d ${avgHoldHours % 24}h`
      : `${avgHoldHours}h`

    const currency = config.user.accounts[0]?.currency ?? 'USD'

    const lines = [
      `📈 <b>${escapeHtml(upperSymbol)} Stats</b>`,
      ``,
      `Net PnL:        ${formatSign(totalPnl)} ${currency}`,
      `Win Rate:       ${winRate}% (${wins}/${total})`,
      `Profit Factor:  ${pf}`,
      `Avg R:R:        ${avgRR}R`,
      `Avg Hold Time:  ${avgHoldStr}`,
      ``,
      `Best Trade:     ${formatSign(bestPnl)} ${currency} (${bestDir})`,
      `Worst Trade:    ${formatSign(worstPnl)} ${currency} (${worstDir})`,
    ]

    return truncateToTelegram(lines.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleStatsCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleRiskCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const userId = config.userId
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        currency: true,
        balance: true,
        currentBalance: true,
        currentEquity: true,
        marginUsed: true,
        freeMargin: true,
        marginLevel: true,
        maxDailyLoss: true,
        maxTotalDrawdown: true,
      },
    })

    if (accounts.length === 0) return 'No active trading accounts found.'

    const sections: string[] = ['⚠️ <b>Account Risk Status</b>']

    for (const acct of accounts) {
      const balance = acct.currentBalance ?? acct.balance ?? 0
      const equity = acct.currentEquity ?? balance
      const marginUsed = acct.marginUsed ?? 0
      const marginLevel = acct.marginLevel

      const drawdown = balance > 0 ? ((balance - equity) / balance * 100) : 0
      const marginPct = balance > 0 ? (marginUsed / balance * 100) : 0

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTrades = await prisma.trade.findMany({
        where: {
          accountId: acct.id,
          status: 'CLOSED',
          exitTime: { gte: today, not: null },
          pnl: { not: null },
        },
        select: { pnl: true },
      })
      const dailyPnl = todayTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      const dailyLossUsed = acct.maxDailyLoss && acct.maxDailyLoss > 0
        ? Math.min(Math.abs(Math.min(dailyPnl, 0)) / acct.maxDailyLoss * 100, 100)
        : 0
      const dailyLossLabel = acct.maxDailyLoss
        ? `${formatSign(dailyPnl)} / -${acct.maxDailyLoss.toFixed(0)} ${acct.currency ?? 'USD'} (${dailyLossUsed.toFixed(0)}% used)`
        : `${formatSign(dailyPnl)} (no limit set)`

      const exposure = marginUsed > 0 ? `${marginUsed.toFixed(0)} ${acct.currency ?? 'USD'}` : 'None'
      const marginLabel = marginLevel !== null && marginLevel !== undefined
        ? `${marginLevel.toFixed(1)}%`
        : (marginUsed > 0 ? `${marginPct.toFixed(1)}% of balance` : 'N/A')

      const safeName = escapeHtml(acct.name)

      sections.push(`\n<b>${safeName}</b>`)
      sections.push(`Drawdown:       ${drawdown.toFixed(1)}%`)
      sections.push(`Daily Loss:     ${dailyLossLabel}`)
      sections.push(`Open Exposure:  ${exposure}`)
      sections.push(`Margin Usage:   ${marginLabel}`)
    }

    return truncateToTelegram(sections.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleRiskCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleChallengeCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const userId = config.userId
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, currency: true, currentBalance: true, balance: true },
    })

    if (accounts.length === 0) return 'No active trading accounts found.'

    const phases = await prisma.challengePhase.findMany({
      where: {
        accountId: { in: accounts.map(a => a.id) },
        status: 'IN_PROGRESS',
      },
      include: { account: { select: { name: true, currency: true, balance: true, currentBalance: true, accountSize: true } } },
      orderBy: { startedAt: 'desc' },
    })

    if (phases.length === 0) return 'No active prop firm challenge phases found.'

    const sections: string[] = ['🎯 <b>Prop Firm Challenge</b>']

    for (const phase of phases) {
      const acct = phase.account
      const safeName = escapeHtml(acct.name)
      const balance = acct.currentBalance ?? acct.balance ?? acct.accountSize ?? 0

      const profitTargetAmount = phase.profitTargetAmount ?? (balance * (phase.profitTarget ?? 0) / 100)
      const currentProfit = phase.currentProgress ? (balance * phase.currentProgress / 100) : 0
      const distanceToTarget = profitTargetAmount - currentProfit

      const maxDrawdownAmount = balance * phase.maxDrawdown / 100
      const currentDrawdownAmount = phase.currentDrawdown ? (balance * phase.currentDrawdown / 100) : 0
      const distanceToLossLimit = maxDrawdownAmount - currentDrawdownAmount

      const startedAt = new Date(phase.startedAt)
      const daysElapsed = Math.floor((Date.now() - startedAt.getTime()) / 86400000)
      const daysRemaining = phase.timeLimitDays ? Math.max(0, phase.timeLimitDays - daysElapsed) : null

      sections.push(`\n<b>${safeName} — ${escapeHtml(phase.phaseName)}</b>`)
      sections.push(`To Profit:  ${formatSign(distanceToTarget)} ${acct.currency ?? 'USD'}`)
      sections.push(`To Loss:    -${distanceToLossLimit.toFixed(0)} ${acct.currency ?? 'USD'} remaining`)
      sections.push(`Progress:   ${phase.currentProgress?.toFixed(1) ?? '0.0'}%`)
      sections.push(`Drawdown:   ${phase.currentDrawdown?.toFixed(1) ?? '0.0'}% / ${phase.maxDrawdown}%`)
      sections.push(`Trading:    ${phase.tradingDaysCount} days${daysRemaining !== null ? ` · ${daysRemaining}d remaining` : ''}`)
    }

    return truncateToTelegram(sections.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleChallengeCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleStreakCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        status: 'CLOSED',
        pnl: { not: null },
        exitTime: { not: null },
      },
      select: {
        id: true,
        pnl: true,
        exitTime: true,
        initialStopLoss: true,
        entryPrice: true,
        stopLoss: true,
        strategyId: true,
      },
      orderBy: { exitTime: 'desc' },
      take: 200,
    })

    if (trades.length === 0) return 'No closed trades found.'

    const dailyPnl = new Map<string, number>()
    for (const t of trades) {
      if (!t.exitTime) continue
      const day = new Date(t.exitTime).toISOString().slice(0, 10)
      dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + (t.pnl ?? 0))
    }
    const sortedDays = [...dailyPnl.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    let winningDayStreak = 0
    for (const [, pnl] of sortedDays) {
      if (pnl > 0) winningDayStreak++
      else break
    }

    let slHonorStreak = 0
    for (const t of trades) {
      if (t.initialStopLoss !== null && t.initialStopLoss !== undefined && t.entryPrice !== null) {
        const slDist = Math.abs(t.entryPrice - t.initialStopLoss)
        const finalSlDist = t.stopLoss !== null && t.stopLoss !== undefined
          ? Math.abs(t.entryPrice - t.stopLoss)
          : slDist
        if (finalSlDist >= slDist * 0.95) {
          slHonorStreak++
        } else {
          break
        }
      }
    }

    const violations = await prisma.strategyViolation.findMany({
      where: {
        accountId: { in: accountIds },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      select: { tradeId: true, occurredAt: true },
    })
    const violationTradeIds = new Set(violations.map(v => v.tradeId))
    let noViolationStreak = 0
    for (const t of trades) {
      if (!violationTradeIds.has(t.id)) {
        noViolationStreak++
      } else {
        break
      }
    }

    const lines = [
      `🔥 <b>Streaks</b>`,
      ``,
      `Winning Days:       ${winningDayStreak} day${winningDayStreak !== 1 ? 's' : ''}`,
      `SL Honored:         ${slHonorStreak} trade${slHonorStreak !== 1 ? 's' : ''}`,
      `No Strategy Viol:   ${noViolationStreak} trade${noViolationStreak !== 1 ? 's' : ''}`,
    ]

    return truncateToTelegram(lines.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleStreakCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handlePlanCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const userId = config.userId

    const strategy = await prisma.strategy.findFirst({
      where: { userId },
      include: {
        checklist: {
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!strategy) return 'No strategy found. Create one in PrismJournal first.'

    const safeName = escapeHtml(strategy.name)
    const lines: string[] = [
      `📋 <b>Strategy: ${safeName}</b>`,
      ``,
    ]

    if (strategy.description) {
      lines.push(`<i>${escapeHtml(strategy.description)}</i>`)
      lines.push('')
    }

    if (strategy.checklist && strategy.checklist.items.length > 0) {
      lines.push('<b>Pre-Trade Checklist:</b>')
      for (const item of strategy.checklist.items) {
        const marker = item.required ? '◆' : '◇'
        lines.push(`  ${marker} ${escapeHtml(item.label)}`)
      }
    } else {
      lines.push('<i>No checklist items defined.</i>')
    }

    return truncateToTelegram(lines.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handlePlanCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

interface MistakePattern {
  name: string
  count: number
  detail: string
}

export async function handleMistakesCommand(chatId: string): Promise<string> {
  try {
    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        status: 'CLOSED',
        pnl: { not: null },
        exitTime: { not: null },
      },
      select: {
        id: true,
        pnl: true,
        mood: true,
        managementRating: true,
        exitTime: true,
        entryTime: true,
      },
      orderBy: { exitTime: 'desc' },
      take: 50,
    })

    if (trades.length === 0) return 'No closed trades found.'

    const patterns: MistakePattern[] = []

    let revengeCount = 0
    for (let i = 0; i < trades.length - 1; i++) {
      const curr = trades[i]
      const prev = trades[i + 1]
      if (
        curr.pnl !== null && curr.pnl < 0 &&
        prev.pnl !== null && prev.pnl < 0 &&
        (curr.mood === 'ANXIOUS' || curr.mood === 'REVENGE')
      ) {
        revengeCount++
      }
    }
    if (revengeCount > 0) {
      patterns.push({ name: 'Revenge Trading', count: revengeCount, detail: `${revengeCount} consecutive loss pair(s) with ANXIOUS/REVENGE mood` })
    }

    const earlySlMoves = trades.filter(t =>
      t.managementRating !== null && t.managementRating < 3
    ).length
    if (earlySlMoves > 0) {
      patterns.push({ name: 'Early SL Moves', count: earlySlMoves, detail: `${earlySlMoves} trade(s) with management rating < 3/5` })
    }

    const dailyTradeCounts = new Map<string, number>()
    const dailyTradeIds = new Map<string, string[]>()
    for (const t of trades) {
      if (!t.exitTime) continue
      const day = new Date(t.exitTime).toISOString().slice(0, 10)
      dailyTradeCounts.set(day, (dailyTradeCounts.get(day) ?? 0) + 1)
      const ids = dailyTradeIds.get(day) ?? []
      ids.push(t.id)
      dailyTradeIds.set(day, ids)
    }
    const overtradingDays = [...dailyTradeCounts.entries()].filter(([, c]) => c >= 5)
    if (overtradingDays.length > 0) {
      const totalOvertradingTrades = overtradingDays.reduce((s, [, c]) => s + c, 0)
      patterns.push({ name: 'Overtrading', count: overtradingDays.length, detail: `${overtradingDays.length} day(s) with 5+ trades (${totalOvertradingTrades} total trades)` })
    }

    if (patterns.length === 0) {
      return '✅ <b>No Recurring Mistakes Found</b>\n\nYour recent 50 trades look clean. Keep it up!'
    }

    patterns.sort((a, b) => b.count - a.count)

    const lines: string[] = [
      `🔍 <b>Top Recurring Patterns</b>`,
      `(last ${trades.length} trades)`,
      ``,
    ]

    for (let i = 0; i < Math.min(3, patterns.length); i++) {
      const p = patterns[i]
      lines.push(`<b>${i + 1}. ${p.name}</b>`)
      lines.push(`   ${p.detail}`)
      if (i < Math.min(3, patterns.length) - 1) lines.push('')
    }

    return truncateToTelegram(lines.join('\n'))
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleMistakesCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleMoodCommand(chatId: string, moodStr: string): Promise<string> {
  try {
    const upperMood = moodStr.toUpperCase()
    if (!(VALID_MOODS as readonly string[]).includes(upperMood)) {
      return `Invalid mood. Use one of: ${VALID_MOODS.join(', ')}`
    }

    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const openTrade = await prisma.trade.findFirst({
      where: {
        accountId: { in: accountIds },
        status: 'OPEN',
      },
      orderBy: { entryTime: 'desc' },
    })

    let trade: { id: string; mood: string | null } | null = openTrade
    if (!trade) {
      trade = await prisma.trade.findFirst({
        where: {
          accountId: { in: accountIds },
          status: 'CLOSED',
          exitTime: { not: null },
        },
        orderBy: { exitTime: 'desc' },
        select: { id: true, mood: true },
      })
    }

    if (!trade) return 'No trades found to update.'

    await prisma.trade.update({
      where: { id: trade.id },
      data: { mood: upperMood as 'CALM' | 'CONFIDENT' | 'NEUTRAL' | 'ANXIOUS' | 'FOMO' | 'REVENGE' },
    })

    const moodEmoji: Record<string, string> = {
      CALM: '🧘',
      CONFIDENT: '💪',
      NEUTRAL: '😐',
      ANXIOUS: '😰',
      FOMO: '🏃',
      REVENGE: '😤',
    }

    return `${moodEmoji[upperMood] ?? '📝'} Mood set to <b>${upperMood}</b> on trade ${trade.id.slice(-6)}`
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleMoodCommand error')
    return 'Something went wrong. Please try again later.'
  }
}

export async function handleNoteCommand(chatId: string, noteText: string): Promise<string> {
  try {
    if (!noteText.trim()) return 'Usage: /note &lt;your note text&gt;'

    const config = await findUserByChatId(chatId)
    if (!config) return 'No PrismJournal account is linked to this Telegram ID.'

    const accountIds = config.user.accounts.map(a => a.id)
    if (accountIds.length === 0) return 'No trading accounts found.'

    const trade = await prisma.trade.findFirst({
      where: {
        accountId: { in: accountIds },
        OR: [
          { status: 'OPEN' },
          { status: 'CLOSED', exitTime: { not: null } },
        ],
      },
      orderBy: [
        { status: 'desc' },
        { entryTime: 'desc' },
      ],
      select: { id: true, notes: true },
    })

    if (!trade) return 'No trades found to add a note to.'

    const updatedNotes = trade.notes
      ? `${trade.notes}\n${noteText}`
      : noteText

    await prisma.trade.update({
      where: { id: trade.id },
      data: { notes: updatedNotes },
    })

    return `📝 Note added to trade ${trade.id.slice(-6)}`
  } catch (e) {
    logger.error({ err: e }, '[telegram-commands] handleNoteCommand error')
    return 'Something went wrong. Please try again later.'
  }
}
