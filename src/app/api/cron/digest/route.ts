import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { sendWeeklyDigestEmail } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import { computeWeeklyDigestData, formatTelegramDigest } from '@/lib/services/digest-computation'
import { ok, unauthorized, internalError } from '@/lib/api/responses'
import logger from '@/lib/logger'

export async function POST() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  try {
    const currentHour = new Date().getUTCHours()
    const isMonday = new Date().getUTCDay() === 1

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
          },
        },
      },
    })

    const results: { email: string; success: boolean; telegramSent?: boolean; error?: string }[] = []

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

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    return ok({ success: true, sent: successCount, failed: failCount, results })
  } catch (error) {
    logger.error({ err: error }, 'Cron digest failed')
    return internalError()
  }
}

export async function GET() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  const count = await prisma.alertConfig.count({
    where: {
      email: { not: null },
      enableWeeklyDigest: true,
    },
  })

  return ok({
    message: 'Weekly digest cron endpoint',
    eligibleUsers: count,
    schedule: 'Call this endpoint every hour. Sends to users whose digestSendHour matches current UTC hour (weekly: Mondays only, daily: every day).',
  })
}

export const runtime = 'nodejs'
