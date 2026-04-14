'use client'

import { useCurrency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/formatNumber'
import { EmptyState } from '@/components/ui/EmptyState'

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

interface MonthlyReturnsProps {
  data: Array<{ month: number; year: number; pnl: number; returnPercent: number }>
}

export function StrategyMonthlyReturns({ data }: MonthlyReturnsProps) {
  const { formatAmount } = useCurrency()

  if (data.length === 0) {
    return (
      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 h-[300px] flex items-center justify-center">
        <EmptyState title="No data yet" className="py-0" />
      </div>
    )
  }

  const yearMap = new Map<number, Map<number, { pnl: number; returnPercent: number }>>()
  for (const m of data) {
    if (!yearMap.has(m.year)) yearMap.set(m.year, new Map())
    yearMap.get(m.year)!.set(m.month, { pnl: m.pnl, returnPercent: m.returnPercent })
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => b - a)

  return (
    <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Monthly Returns</h3>
      <div className="space-y-3">
        {years.map((year) => {
          const monthData = yearMap.get(year)!
          return (
            <div key={year}>
              <div className="text-[10px] font-black text-gray-600 mb-1">{year}</div>
              <div className="grid grid-cols-12 gap-1">
                {MONTH_LABELS.map((label, i) => {
                  const month = i + 1
                  const cellData = monthData.get(month)
                  const hasData = cellData !== undefined
                  const pnl = cellData?.pnl ?? 0
                  const isPositive = pnl >= 0

                  return (
                    <div
                      key={month}
                      className={cn(
                        'aspect-square rounded text-center flex flex-col items-center justify-center text-[8px] font-bold border',
                        !hasData && 'bg-white/5 border-white/5 text-gray-700',
                        hasData && isPositive && 'bg-profit/10 border-profit/20 text-profit',
                        hasData && !isPositive && 'bg-loss/10 border-loss/20 text-loss'
                      )}
                      title={hasData ? `${formatAmount(pnl)}` : undefined}
                    >
                      <span>{label}</span>
                      {hasData && <span className="text-[6px] opacity-70">{formatPercent(cellData.returnPercent, 0)}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
