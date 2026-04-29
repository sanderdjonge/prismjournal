interface TradePnlInput {
  entryPrice: number
  exitPrice: number | null
  mae: number | null
  mfe: number | null
  volume: number
  direction: 'LONG' | 'SHORT'
  entryTime: string | Date | null
  exitTime: string | Date | null
}

interface PnlPoint {
  timestamp: number
  pnl: number
}

export function generateTradePnlCurve(trade: TradePnlInput): PnlPoint[] {
  const entryPrice = trade.entryPrice
  const exitPrice = trade.exitPrice ?? entryPrice
  const mae = trade.mae ?? 0
  const mfe = trade.mfe ?? 0
  const directionMul = trade.direction === 'LONG' ? 1 : -1

  const entryMs = trade.entryTime ? new Date(trade.entryTime).getTime() : Date.now()
  const exitMs = trade.exitTime ? new Date(trade.exitTime).getTime() : entryMs + 3600000
  const duration = exitMs - entryMs

  if (duration <= 0) {
    return [
      { timestamp: entryMs, pnl: 0 },
      { timestamp: exitMs, pnl: 0 },
    ]
  }

  const finalPnl = (exitPrice - entryPrice) * directionMul * trade.volume

  const numPoints = 30
  const points: PnlPoint[] = [{ timestamp: entryMs, pnl: 0 }]

  const maeRelTime = 0.25
  const mfeRelTime = 0.6

  const minPnl = mae !== 0 ? mae * trade.volume * directionMul : Math.min(0, finalPnl)
  const maxPnl = mfe !== 0 ? mfe * trade.volume * directionMul : Math.max(0, finalPnl)

  for (let i = 1; i < numPoints; i++) {
    const relTime = i / numPoints
    const ts = entryMs + duration * relTime

    let pnlAtPoint: number

    if (relTime <= maeRelTime) {
      const t = relTime / maeRelTime
      const ease = t * t
      pnlAtPoint = ease * minPnl
    } else if (relTime <= mfeRelTime) {
      const t = (relTime - maeRelTime) / (mfeRelTime - maeRelTime)
      const ease = t * (2 - t)
      pnlAtPoint = minPnl + ease * (maxPnl - minPnl)
    } else {
      const t = (relTime - mfeRelTime) / (1 - mfeRelTime)
      const ease = t * t * (3 - 2 * t)
      pnlAtPoint = maxPnl + ease * (finalPnl - maxPnl)
    }

    points.push({ timestamp: ts, pnl: pnlAtPoint })
  }

  points.push({ timestamp: exitMs, pnl: finalPnl })

  return points
}
