'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useCurrency } from '@/lib/currency'

interface EquityChartProps {
  data: Array<{ date: string; cumulative: number }>
}

export function StrategyEquityChart({ data }: EquityChartProps) {
  const { formatAmount } = useCurrency()

  if (data.length === 0) {
    return (
      <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6 h-[300px] flex items-center justify-center">
        <p className="text-text-muted text-sm">No closed trades yet</p>
      </div>
    )
  }

  return (
    <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Equity Curve</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(value) => formatAmount(value)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const value = payload[0]?.value
                  const numValue = typeof value === 'number' ? value : 0
                  return (
                    <div className="glass-card p-3 border-border-color bg-black/80 backdrop-blur-md">
                      <p className="text-[10px] text-text-muted mb-1">{label}</p>
                      <p className="text-sm font-bold text-primary">
                        {formatAmount(numValue)}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#00f2ff"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
