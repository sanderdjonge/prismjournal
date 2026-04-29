import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import type { Session } from 'next-auth'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { ok, badRequest, internalError } from '@/lib/api/responses'
import { buildCorrelationMatrix, generateFilterOutcomes } from '@/lib/services/what-if/correlation-matrix'
import type { TradeData } from '@/lib/services/what-if/types'

export const GET = withAuth(async (
  request: NextRequest,
  _ctx: Record<string, unknown>,
  session: Session & { user: { id: string } }
) => {
  const { searchParams } = new URL(request.url)

  const periodDays = Math.min(Math.max(parseInt(searchParams.get('period') ?? '90', 10) || 90, 1), 365)
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  const whereClause: Record<string, unknown> = {
    account: { userId: session.user.id },
    exitTime: { not: null, gte: startDate },
  }

  if (accountIds?.length) {
    whereClause.accountId = { in: accountIds }
  }

  try {
    const trades = await prisma.trade.findMany({
      where: whereClause,
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit: true,
        pnl: true,
        rMultiple: true,
        entryTime: true,
        exitTime: true,
        initialStopLoss: true,
        mae: true,
        mfe: true,
        volume: true,
      },
      orderBy: { entryTime: 'asc' },
    })

    const tradeData: TradeData[] = trades.map(t => ({
      ...t,
      direction: t.direction as string,
      entryTime: new Date(t.entryTime),
      exitTime: t.exitTime ? new Date(t.exitTime) : null,
      mae: t.mae,
      mfe: t.mfe,
      volume: t.volume ?? undefined,
    }))

    if (tradeData.length < 3) {
      return badRequest('Not enough trades for correlation analysis (minimum 3)')
    }

    const filterOutcomes = generateFilterOutcomes(tradeData)
    const matrix = buildCorrelationMatrix(tradeData, filterOutcomes)

    return ok({
      variables: matrix.variables,
      matrix: matrix.matrix.map(row =>
        row.map(cell => ({
          row: cell.row,
          column: cell.column,
          value: Math.round(cell.value * 1000) / 1000,
          significance: cell.significance,
        }))
      ),
      generatedAt: matrix.generatedAt.toISOString(),
      tradeCount: matrix.tradeCount,
    })
  } catch (error) {
    logger.error({ error, userId: session.user.id }, '[what-if/correlation] Error building correlation matrix')
    return internalError()
  }
})
