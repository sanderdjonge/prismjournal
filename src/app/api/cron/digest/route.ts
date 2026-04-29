import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { sendWeeklyDigestEmail } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import { computeWeeklyDigestData, formatTelegramDigest } from '@/lib/services/digest-computation'
import { sendWeeklyChartDigest } from '@/lib/services/weekly-chart-digest'
import { ok, internalError } from '@/lib/api/responses'
import { verifyCronSecret } from '@/lib/api/verifyCronSecret'
import logger from '@/lib/logger'

interface MorningBriefingData {
  userId: string
  telegramId: string
  timezone: string
  accountId: string
}

async function sendMorningBriefing(data: MorningBriefingData): Promise<boolean> {
  const { userId, telegramId, timezone, accountId } = data

  const now = new Date()
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const userHour = userTime.getHours()

  if (userHour < 6 || userHour >= 10) return false

  try {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setHours(23, 59, 59, 999)

    const yesterdayTrades = await prisma.trade.findMany({
      where: {
        accountId,
        exitTime: { gte: yesterday, lte: yesterdayEnd },
        pnl: { not: null },
      },
    })

    const pnl = yesterdayTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const wins = yesterdayTrades.filter(t => (t.pnl ?? 0) > 0).length
    const winRate = yesterdayTrades.length > 0 ? (wins / yesterdayTrades.length) * 100 : 0

    const openPositions = await prisma.trade.count({
      where: {
        accountId,
        exitTime: null,
      },
    })

    const recentDays = await prisma.trade.findMany({
      where: {
        accountId,
        exitTime: { not: null },
        pnl: { not: null },
      },
      orderBy: { exitTime: 'desc' },
      take: 50,
      select: { exitTime: true, pnl: true },
    })

    let streak = 0
    let streakType: 'winning' | 'losing' | 'none' = 'none'
    for (const trade of recentDays) {
      const isWin = (trade.pnl ?? 0) > 0
      if (streakType === 'none') {
        streakType = isWin ? 'winning' : 'losing'
        streak = 1
      } else if ((streakType === 'winning' && isWin) || (streakType === 'losing' && !isWin)) {
        streak++
      } else {
        break
      }
    }

    const recentMoods = await prisma.trade.findMany({
      where: {
        accountId,
        mood: { not: null },
      },
      orderBy: { exitTime: 'desc' },
      take: 5,
      select: { mood: true },
    })

    const moodMap: Record<string, number> = {
      CALM: 1, CONFIDENT: 2, NEUTRAL: 3, ANXIOUS: 4, FOMO: 5, REVENGE: 6,
    }
    const moodLabels: Record<string, string> = {
      CALM: '🧘 Calm', CONFIDENT: '💪 Confident', NEUTRAL: '😐 Neutral',
      ANXIOUS: '😰 Anxious', FOMO: '🏃 FOMO', REVENGE: '😤 Revenge',
    }

    let avgMood = 'Not logged'
    if (recentMoods.length > 0) {
      const moodValues = recentMoods
        .map(t => moodMap[t.mood ?? ''])
        .filter((v): v is number => v !== undefined)
      if (moodValues.length > 0) {
        const avgIdx = Math.round(moodValues.reduce((a, b) => a + b, 0) / moodValues.length)
        const closest = Object.entries(moodMap).sort(([, a], [, b]) => Math.abs(a - avgIdx) - Math.abs(b - avgIdx))[0]
        avgMood = moodLabels[closest[0]] ?? 'Not logged'
      }
    }

    const lines = [
      `<b>🌅 Morning Briefing</b>`,
      `<b>Yesterday:</b> ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      `<b>Win Rate:</b> ${winRate.toFixed(1)}%`,
      `<b>Open Positions:</b> ${openPositions}`,
      `<b>Upcoming Events:</b> Check your economic calendar`,
      `<b>Streak:</b> ${streak > 0 ? `${streak} ${streakType} day${streak > 1 ? 's' : ''}` : 'None'}`,
      `<b>Mood:</b> ${avgMood}`,
    ]

    return await sendTelegramMessage(telegramId, lines.join('\n'))
  } catch (error) {
    logger.error({ err: error, userId }, 'Morning briefing failed')
    return false
  }
}

export async function POST(request: NextRequest) {
  const cronCheck = verifyCronSecret(request);
  if (cronCheck) return cronCheck;

  try {
    const currentHour = new Date().getUTCHours()
    const isMonday = new Date().getUTCDay() === 1
    const isSunday = new Date().getUTCDay() === 0

    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        email: { not: null },
        enableWeeklyDigest: true,
        digestSendHour: currentHour,
      },
      include: {
        user: {
          include: {
            accounts: {
              where: { isActive: true },
              take: 1,
            },
            settings: {
              select: { timezone: true },
            },
          },
        },
      },
    })

    const results: { email: string; success: boolean; telegramSent?: boolean; morningBriefing?: boolean; chartDigest?: boolean; error?: string }[] = []

    const eligible = alertConfigs.filter(c =>
      (c.digestFrequency ?? 'WEEKLY') === 'DAILY' || isMonday
    )

    for (const config of eligible) {
      const email = config.email!
      const account = config.user.accounts[0]

      if (!account) {
        results.push({ email, success: false, error: 'No active account' })
        continue
      }

      try {
        const digestData = await computeWeeklyDigestData(account.id, config.userId)

        const emailResult = await sendWeeklyDigestEmail({
          ...digestData,
          email,
          dashboardUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        })

        let telegramSent = false
        if (config.telegramId && config.enableTrades) {
          const telegramMessage = formatTelegramDigest(digestData)
          telegramSent = await sendTelegramMessage(config.telegramId, telegramMessage)
        }

        results.push({
          email,
          success: emailResult.success,
          telegramSent,
          error: emailResult.error,
        })
      } catch (error) {
        results.push({ email, success: false, error: String(error) })
      }
    }

    // Morning briefing: send to users with enableTrades + telegramId
    const morningConfigs = await prisma.alertConfig.findMany({
      where: {
        enableTrades: true,
        telegramId: { not: null },
      },
      include: {
        user: {
          include: {
            accounts: {
              where: { isActive: true },
              take: 1,
            },
            settings: {
              select: { timezone: true },
            },
          },
        },
      },
    })

    let morningBriefingCount = 0
    for (const config of morningConfigs) {
      const account = config.user.accounts[0]
      if (!account || !config.telegramId) continue

      const timezone = config.user.settings?.timezone ?? 'Europe/Amsterdam'
      const sent = await sendMorningBriefing({
        userId: config.userId,
        telegramId: config.telegramId,
        timezone,
        accountId: account.id,
      })

      if (sent) morningBriefingCount++
    }

    // Weekly chart digest: send on Sundays to users with enableWeeklyDigest + telegramId
    let chartDigestCount = 0
    if (isSunday) {
      const chartConfigs = await prisma.alertConfig.findMany({
        where: {
          enableWeeklyDigest: true,
          telegramId: { not: null },
        },
        include: {
          user: {
            include: {
              accounts: {
                where: { isActive: true },
                take: 1,
              },
            },
          },
        },
      })

      for (const config of chartConfigs) {
        const account = config.user.accounts[0]
        if (!account || !config.telegramId) continue

        try {
          const sent = await sendWeeklyChartDigest(config.userId, account.id, config.telegramId)
          if (sent) chartDigestCount++
        } catch (error) {
          logger.error({ err: error, userId: config.userId }, 'Weekly chart digest failed')
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    return ok({
      success: true,
      sent: successCount,
      failed: failCount,
      morningBriefings: morningBriefingCount,
      chartDigests: chartDigestCount,
      results,
    })
  } catch (error) {
    logger.error({ err: error }, 'Cron digest failed')
    return internalError()
  }
}

export async function GET(request: NextRequest) {
  const cronCheck = verifyCronSecret(request);
  if (cronCheck) return cronCheck;

  const count = await prisma.alertConfig.count({
    where: {
      email: { not: null },
      enableWeeklyDigest: true,
    },
  })

  return ok({
    message: 'Weekly digest cron endpoint',
    eligibleUsers: count,
    schedule: 'Call this endpoint every hour. Sends to users whose digestSendHour matches current UTC hour (weekly: Mondays only, daily: every day). Morning briefings sent 06:00-10:00 user timezone. Chart digest sent Sundays.',
  })
}

export const runtime = 'nodejs'
