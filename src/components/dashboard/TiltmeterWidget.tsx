'use client'

import { useState } from 'react'
import { useTiltmeterScore } from '@/hooks/useTiltmeter'

interface Props {
  periodDays?: number
  strategyId?: string
  accountId?: string
}

const RULE_DESCRIPTIONS: Record<string, { label: string; description: string; severity: 'low' | 'medium' | 'high' }> = {
  MAX_DAILY_LOSS: { label: 'Daily Loss Limit', description: 'Exceeded maximum daily loss', severity: 'high' },
  MAX_DAILY_TRADES: { label: 'Daily Trade Limit', description: 'Traded more than allowed per day', severity: 'low' },
  MIN_RR_RATIO: { label: 'Risk/Reward Ratio', description: 'Entered with insufficient R:R', severity: 'medium' },
  ALLOWED_TIME_WINDOWS: { label: 'Trading Hours', description: 'Traded outside allowed hours', severity: 'low' },
  ALLOWED_SYMBOLS: { label: 'Symbol Filter', description: 'Traded unapproved instruments', severity: 'low' },
  MAX_POSITION_SIZE: { label: 'Position Size', description: 'Exceeded max lot size', severity: 'high' },
  NO_OVERTRADING: { label: 'Overtrading', description: 'Too many trades in short time', severity: 'medium' },
  MANDATORY_STOP_LOSS: { label: 'Stop Loss', description: 'Traded without stop loss', severity: 'high' },
  MAX_HOLDING_TIME: { label: 'Max Hold Time', description: 'Held position too long', severity: 'low' },
  MIN_HOLDING_TIME: { label: 'Min Hold Time', description: 'Exited position too quickly', severity: 'low' },
};

export default function TiltmeterWidget({ periodDays = 30, strategyId, accountId }: Props) {
  const { data, isLoading } = useTiltmeterScore(accountId, periodDays)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-surface-elevated rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-surface-elevated rounded"></div>
      </div>
    );
  }

  if (!data) return null

  const getTiltLabel = (score: number) => {
    if (score <= 20) return { text: 'Zen', emoji: '🧘', color: 'text-profit', bg: 'bg-profit', advice: 'Excellent discipline! Keep following your rules.' };
    if (score <= 40) return { text: 'Calm', emoji: '😌', color: 'text-profit', bg: 'bg-profit', advice: 'Minor slip-ups. Stay focused on your process.' };
    if (score <= 60) return { text: 'Edgy', emoji: '😐', color: 'text-warning', bg: 'bg-warning', advice: 'Some concerning patterns. Review your recent trades.' };
    if (score <= 80) return { text: 'Stressed', emoji: '😤', color: 'text-warning', bg: 'bg-warning', advice: 'Significant violations. Consider taking a break.' };
    return { text: 'Tilt', emoji: '🤯', color: 'text-loss', bg: 'bg-loss', advice: 'STOP TRADING. Step away and reset your mindset.' };
  };

  const tilt = getTiltLabel(data.score)
  const sortedComponents = Object.entries(data.components)
    .sort((a, b) => b[1].weightedScore - a[1].weightedScore)

  return (
    <div className="glass-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Tiltmeter
          </h3>
          <p className="text-xs text-text-muted">Last {periodDays} days</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{tilt.emoji}</div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${tilt.color}`}>
              {tilt.text}
            </span>
            <span className="text-sm text-text-secondary">
              {data.score}/100
            </span>
          </div>
          <div className="text-xs text-text-muted mt-1">
            Based on {data.totalViolations} violation{data.totalViolations !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="relative h-3 bg-surface-elevated rounded-full overflow-hidden mb-4">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${data.score}%`,
            background: `linear-gradient(90deg,
              #22c55e 0%,
              #84cc16 20%,
              #eab308 40%,
              #f97316 60%,
              #ef4444 80%,
              #dc2626 100%
            )`,
          }}
        />
        <div className="absolute inset-0 flex justify-between px-1">
          {[20, 40, 60, 80].map(marker => (
            <div key={marker} className="w-px h-full bg-border-subtle" />
          ))}
        </div>
      </div>

      <div className={`text-xs p-2 rounded mb-4 ${
        data.score <= 40 ? 'bg-profit-bg text-profit' :
        data.score <= 60 ? 'bg-warning-bg text-warning' :
        'bg-loss-bg text-loss'
      }`}>
        💡 {tilt.advice}
      </div>

      {sortedComponents.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>Violation Breakdown</span>
            <span className="text-xs">{expanded ? '▲' : '▼'}</span>
          </button>

          {sortedComponents.map(([type, info]) => {
            const ruleInfo = RULE_DESCRIPTIONS[type] || { label: formatRuleType(type), description: '', severity: 'medium' as const };
            const severityColors = {
              high: 'text-loss',
              medium: 'text-warning',
              low: 'text-text-secondary',
            };

            return (
              <div key={type} className={`p-2 rounded bg-surface-elevated ${expanded ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary font-medium">
                    {ruleInfo.label}
                  </span>
                  <span className={`text-xs font-bold ${severityColors[ruleInfo.severity]}`}>
                    {info.count}x
                  </span>
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {ruleInfo.description}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ruleInfo.severity === 'high' ? 'bg-loss' : ruleInfo.severity === 'medium' ? 'bg-warning' : 'bg-text-secondary'}`}
                      style={{ width: `${Math.min(100, info.weightedScore * 10)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted">
                    impact: {info.weightedScore.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}

          {!expanded && (
            <div className="flex flex-wrap gap-2">
              {sortedComponents.slice(0, 3).map(([type, info]) => {
                const ruleInfo = RULE_DESCRIPTIONS[type] || { label: formatRuleType(type), severity: 'medium' as const };
                const severityColors = {
                  high: 'bg-loss-bg text-loss',
                  medium: 'bg-warning-bg text-warning',
                  low: 'bg-surface-elevated text-text-secondary',
                };
                return (
                  <span key={type} className={`px-2 py-1 rounded text-[10px] font-bold ${severityColors[ruleInfo.severity]}`}>
                    {ruleInfo.label} ({info.count})
                  </span>
                );
              })}
              {sortedComponents.length > 3 && (
                <span className="px-2 py-1 rounded text-[10px] text-text-muted bg-surface-elevated">
                  +{sortedComponents.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {sortedComponents.length === 0 && (
        <div className="text-center py-4 text-text-muted">
          <div className="text-2xl mb-1">✨</div>
          <div className="text-sm">No violations in the last {periodDays} days!</div>
        </div>
      )}
    </div>
  );
}

function formatRuleType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
