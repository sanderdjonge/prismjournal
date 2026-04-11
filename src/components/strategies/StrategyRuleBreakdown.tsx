'use client'

import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { useCurrency } from '@/lib/currency'
import { cn } from '@/lib/cn'

interface RuleBreakdownProps {
  data: Array<{
    ruleId: string
    ruleType: string
    violationCount: number
    violationPercent: number
    pnlImpact: number | null
  }>
}

const RULE_TYPE_LABELS: Record<string, string> = {
  MAX_RISK_PER_TRADE: 'Max Risk',
  MAX_POSITIONS: 'Max Positions',
  MAX_DAILY_LOSS: 'Max Daily Loss',
  NO_NEWS_TRADING: 'No News Trading',
  MAX_HOLDING_TIME: 'Max Hold Time',
  MIN_HOLDING_TIME: 'Min Hold Time',
  MAX_DAILY_TRADES: 'Max Daily Trades',
}

export function StrategyRuleBreakdown({ data }: RuleBreakdownProps) {
  const { formatAmount } = useCurrency()

  if (data.length === 0) {
    return (
      <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-100 mb-4">Rule Compliance</h3>
        <div className="flex items-center gap-2 text-profit">
          <CheckCircle size={16} />
          <span className="text-sm">Perfect compliance - no violations</span>
        </div>
      </div>
    )
  }

  const getStatus = (percent: number) => {
    if (percent < 10) return { icon: CheckCircle, color: 'text-profit', label: 'OK' }
    if (percent < 20) return { icon: AlertCircle, color: 'text-yellow-400', label: 'Warning' }
    return { icon: AlertTriangle, color: 'text-loss', label: 'Alert' }
  }

  return (
    <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Rule Compliance Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/10">
              <th className="pb-3 font-medium">Rule</th>
              <th className="pb-3 font-medium text-right">Violations</th>
              <th className="pb-3 font-medium text-right">P&L Impact</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((rule) => {
              const status = getStatus(rule.violationPercent)
              const Icon = status.icon
              const label = RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType

              return (
                <tr key={rule.ruleId} className="border-b border-white/5 last:border-0">
                  <td className="py-3 text-gray-200">{label}</td>
                  <td className="py-3 text-right text-gray-400">
                    {rule.violationCount}
                    <span className="text-xs text-gray-600 ml-1">({rule.violationPercent.toFixed(0)}%)</span>
                  </td>
                  <td className={cn(
                    'py-3 text-right font-mono',
                    (rule.pnlImpact ?? 0) >= 0 ? 'text-gray-400' : 'text-loss'
                  )}>
                    {rule.pnlImpact !== null ? formatAmount(rule.pnlImpact) : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn('flex items-center justify-end gap-1', status.color)}>
                      <Icon size={14} />
                      <span className="text-xs">{status.label}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
