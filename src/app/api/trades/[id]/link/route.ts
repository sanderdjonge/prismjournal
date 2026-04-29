import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest, notFound } from '@/lib/api/responses'
import { validateBody } from '@/lib/validations/common'

const linkSchema = z.object({
  relatedTradeId: z.string().min(1),
})

export const POST = withAuth(async (req, ctx, session) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const userId = session.user.id

  const validation = await validateBody(req, linkSchema)
  if (!validation.success) return validation.response

  const { relatedTradeId } = validation.data

  if (id === relatedTradeId) {
    return badRequest('Cannot link a trade to itself')
  }

  const [trade, relatedTrade] = await Promise.all([
    prisma.trade.findFirst({ where: { id, account: { userId } }, select: { id: true, relatedTradeIds: true } }),
    prisma.trade.findFirst({ where: { id: relatedTradeId, account: { userId } }, select: { id: true, relatedTradeIds: true } }),
  ])

  if (!trade) return notFound('Trade')
  if (!relatedTrade) return notFound('Related trade')

  const currentIds = trade.relatedTradeIds as string[]
  if (currentIds.includes(relatedTradeId)) {
    return badRequest('Trades are already linked')
  }

  await prisma.$transaction([
    prisma.trade.update({
      where: { id },
      data: { relatedTradeIds: { set: [...currentIds, relatedTradeId] } },
    }),
    prisma.trade.update({
      where: { id: relatedTradeId },
      data: { relatedTradeIds: { set: [...(relatedTrade.relatedTradeIds as string[]), id] } },
    }),
  ])

  return ok({ success: true })
})

export const DELETE = withAuth(async (req, ctx, session) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const userId = session.user.id

  const validation = await validateBody(req, linkSchema)
  if (!validation.success) return validation.response

  const { relatedTradeId } = validation.data

  const [trade, relatedTrade] = await Promise.all([
    prisma.trade.findFirst({ where: { id, account: { userId } }, select: { id: true, relatedTradeIds: true } }),
    prisma.trade.findFirst({ where: { id: relatedTradeId, account: { userId } }, select: { id: true, relatedTradeIds: true } }),
  ])

  if (!trade) return notFound('Trade')
  if (!relatedTrade) return notFound('Related trade')

  await prisma.$transaction([
    prisma.trade.update({
      where: { id },
      data: { relatedTradeIds: { set: (trade.relatedTradeIds as string[]).filter(rid => rid !== relatedTradeId) } },
    }),
    prisma.trade.update({
      where: { id: relatedTradeId },
      data: { relatedTradeIds: { set: (relatedTrade.relatedTradeIds as string[]).filter(rid => rid !== id) } },
    }),
  ])

  return ok({ success: true })
})

export const runtime = 'nodejs'
