import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest, internalError } from '@/lib/api/responses'
import { validateBody } from '@/lib/validations/common'
import { z } from 'zod'
import logger from '@/lib/logger'

const deleteConfirmSchema = z.object({
  confirm: z.string().min(1),
})

export const POST = withAuth(async (request: NextRequest, _ctx: Record<string, unknown>, session) => {
  const userId = session.user.id

  const validation = await validateBody(request, deleteConfirmSchema)
  if (!validation.success) return validation.response

  const { confirm } = validation.data

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user || confirm !== user.email) {
    return badRequest('Confirmation email does not match. Type your email to confirm deletion.')
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

    await prisma.$transaction([
      prisma.media.deleteMany({ where: { trade: { accountId: { in: accountIds } } } }),
      prisma.tradeTag.deleteMany({ where: { trade: { accountId: { in: accountIds } } } }),
      prisma.checklistCompletion.deleteMany({ where: { trade: { accountId: { in: accountIds } } } }),
      prisma.shareCard.deleteMany({ where: { trade: { accountId: { in: accountIds } } } }),
      prisma.pendingScreenshot.deleteMany({ where: { trade: { accountId: { in: accountIds } } } }),
      prisma.strategyViolation.deleteMany({ where: { accountId: { in: accountIds } } }),
      prisma.preTradeNote.deleteMany({ where: { userId } }),
      prisma.trade.deleteMany({ where: { accountId: { in: accountIds } } }),

      prisma.equitySnapshot.deleteMany({ where: { accountId: { in: accountIds } } }),
      prisma.dailyAccountSnapshot.deleteMany({ where: { accountId: { in: accountIds } } }),
      prisma.challengePhase.deleteMany({ where: { accountId: { in: accountIds } } }),
      prisma.tradingAccount.deleteMany({ where: { userId } }),

      prisma.checklistItem.deleteMany({ where: { checklist: { userId } } }),
      prisma.checklist.deleteMany({ where: { userId } }),
      prisma.strategy.deleteMany({ where: { userId } }),

      prisma.tag.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.alertConfig.deleteMany({ where: { userId } }),
      prisma.tiltmeterSnapshot.deleteMany({ where: { userId } }),
      prisma.tradingChallenge.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.userSettings.deleteMany({ where: { userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId } }),
      prisma.auditLog.deleteMany({ where: { userId } }),
      prisma.inviteToken.deleteMany({ where: { createdBy: userId } }),

      prisma.user.delete({ where: { id: userId } }),
    ])

    logger.info({ userId }, '[export/delete] User data deleted (GDPR right to erasure)')

    return ok({ success: true, message: 'All data deleted successfully.' })
  } catch (error) {
    logger.error({ err: error, userId }, '[export/delete] Failed to delete user data')
    return internalError()
  }
})

export const runtime = 'nodejs'
