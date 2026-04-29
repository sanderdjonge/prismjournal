import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api/withAuth'
import { internalError } from '@/lib/api/responses'
import logger from '@/lib/logger'

const EXPORT_COOLDOWN_MS = 60 * 60 * 1000

const exportLimiter = new Map<string, number>()

setInterval(() => {
  const now = Date.now()
  for (const [key, lastExport] of exportLimiter) {
    if (now - lastExport > EXPORT_COOLDOWN_MS) {
      exportLimiter.delete(key)
    }
  }
}, 5 * 60 * 1000).unref()

export const GET = withAuth(async (_req: NextRequest, _ctx: Record<string, unknown>, session) => {
  const userId = session.user.id

  const lastExport = exportLimiter.get(userId)
  if (lastExport && Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
    const retryAfter = Math.ceil((EXPORT_COOLDOWN_MS - (Date.now() - lastExport)) / 1000)
    return new Response(
      JSON.stringify({ error: 'Export rate limit exceeded', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      },
    )
  }

  try {
    const accountIds = (await prisma.tradingAccount.findMany({
      where: { userId },
      select: { id: true },
    })).map(a => a.id)

    const strategyIds = (await prisma.strategy.findMany({
      where: { userId },
      select: { id: true },
    })).map(s => s.id)

    const [
      profile,
      settings,
      accounts,
      trades,
      strategies,
      tags,
      notifications,
      checklistCompletions,
      preTradeNotes,
      tiltmeterSnapshots,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          defaultCurrency: true,
          showPrismScoreOnShare: true,
          createdAt: true,
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
      }),
      prisma.tradingAccount.findMany({
        where: { userId },
        include: {
          equitySnapshots: { orderBy: { timestamp: 'desc' } },
          dailySnapshots: { orderBy: { snapshotDate: 'desc' } },
          challengePhases: true,
        },
      }),
      prisma.trade.findMany({
        where: { accountId: { in: accountIds } },
        include: {
          media: true,
          tags: { include: { tag: true } },
          checklistCompletion: true,
          preTradeNote: true,
          shareCards: true,
        },
        orderBy: { entryTime: 'desc' },
      }),
      prisma.strategy.findMany({
        where: { userId },
        include: {
          violations: true,
          checklistCompletions: true,
        },
      }),
      prisma.tag.findMany({
        where: { userId },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checklistCompletion.findMany({
        where: { strategyId: { in: strategyIds } },
      }),
      prisma.preTradeNote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tiltmeterSnapshot.findMany({
        where: { userId },
        orderBy: { periodStart: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      profile,
      settings,
      accounts,
      trades,
      strategies,
      tags,
      notifications,
      checklistCompletions,
      preTradeNotes,
      tiltmeterSnapshots,
      auditLogs,
    }

    exportLimiter.set(userId, Date.now())

    const date = new Date().toISOString().split('T')[0]
    const filename = `prismjournal-export-${userId}-${date}.json`

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error({ err: error, userId }, '[export] Failed to export user data')
    return internalError()
  }
})

export const runtime = 'nodejs'
