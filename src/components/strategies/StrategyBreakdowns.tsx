'use client'

import { useCurrency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/formatNumber'
import { EmptyState } from '@/components/ui/EmptyState'

interface BreakdownsProps {
  bySymbol: Array<{ symbol: string; winRate: number; pnl: number; count: number }>
  byDirection: {
    long: { winRate: number; pnl: number; avgR: number; count: number }
    short: { winRate: number; pnl: number; avgR: number; count: number }
  }
  byTimeOfDay: Array<{ period: string; winRate: number; pnl: number; count: number }>
  byDayOfWeek: Array<{ day: number; winRate: number; pnl: number; count: number }>
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function StrategyBreakdowns({ bySymbol, byDirection, byTimeOfDay, byDayOfWeek }: BreakdownsProps) {
  const { formatAmount } = useCurrency()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">By Symbol</h4>
        <div className="space-y-2">
          {bySymbol.length === 0 ? (
            <EmptyState title="No data" className="py-4" />
          ) : (
            bySymbol.map((s) => (
              <div key={s.symbol} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-mono">{s.symbol}</span>
                <div className="text-right">
                  <span className={cn('font-bold', s.winRate >= 50 ? 'text-profit' : 'text-loss')}>
                    {formatPercent(s.winRate, 0)}
                  </span>
                  <span className="text-gray-600 ml-2">{formatAmount(s.pnl)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">By Direction</h4>
        <div className="space-y-3">
          {[
            { label: 'LONG', data: byDirection.long },
            { label: 'SHORT', data: byDirection.short },
          ].map(({ label, data }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-gray-300">{label}</span>
              <div className="text-right">
                <span className={cn('font-bold', data.winRate >= 50 ? 'text-profit' : 'text-loss')}>
                  {formatPercent(data.winRate, 0)}
                </span>
                <span className="text-gray-600 ml-2">{formatAmount(data.pnl)}</span>
                <span className="text-gray-700 ml-1">({data.count})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">By Time</h4>
        <div className="space-y-2">
          {byTimeOfDay.map((t) => (
            <div key={t.period} className="flex items-center justify-between text-xs">
              <span className="text-gray-300">{t.period}</span>
              <div className="text-right">
                <span className={cn('font-bold', t.winRate >= 50 ? 'text-profit' : 'text-loss')}>
                  {formatPercent(t.winRate, 0)}
                </span>
                <span className="text-gray-600 ml-2">{formatAmount(t.pnl)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">By Day</h4>
        <div className="space-y-2">
          {byDayOfWeek.map((d) => (
            <div key={d.day} className="flex items-center justify-between text-xs">
              <span className="text-gray-300">{DAY_LABELS[d.day]}</span>
              <div className="text-right">
                <span className={cn('font-bold', d.winRate >= 50 ? 'text-profit' : 'text-loss')}>
                  {formatPercent(d.winRate, 0)}
                </span>
                <span className="text-gray-600 ml-2">{formatAmount(d.pnl)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
