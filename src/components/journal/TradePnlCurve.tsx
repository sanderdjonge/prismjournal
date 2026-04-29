'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { generateTradePnlCurve } from '@/lib/services/trade-pnl-curve'

interface TradePnlCurveProps {
  trade: {
    entryPrice: number
    exitPrice: number | null
    mae: number | null
    mfe: number | null
    volume: number
    type: 'LONG' | 'SHORT'
    entryTime: string | null
    exitTime: string | null
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function TradePnlCurve({ trade }: TradePnlCurveProps) {
  const data = useMemo(() => {
    const points = generateTradePnlCurve({
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      mae: trade.mae,
      mfe: trade.mfe,
      volume: trade.volume,
      direction: trade.type,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
    })
    return points.map(p => ({
      time: formatTime(p.timestamp),
      pnl: Number(p.pnl.toFixed(2)),
    }))
  }, [trade])

  const isProfit = data.length > 0 && data[data.length - 1].pnl >= 0

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">P&L Curve</div>
      <div className="bg-surface-elevated border border-border-subtle rounded-lg p-2" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 8, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 8, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 15, 20, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                fontSize: '10px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: isProfit ? '#22c55e' : '#ef4444' }}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={isProfit ? '#22c55e' : '#ef4444'}
              strokeWidth={1.5}
              fill={isProfit ? 'url(#pnlGradientPos)' : 'url(#pnlGradientNeg)'}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
