'use client';

import { useEffect, useState } from 'react';

interface TiltmeterScore {
  score: number;
  totalViolations: number;
  components: Record<string, { count: number; weightedScore: number }>;
}

interface Props {
  periodDays?: number;
  strategyId?: string;
  accountId?: string;
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
  const [data, setData] = useState<TiltmeterScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchScore() {
      try {
        const params = new URLSearchParams();
        params.set('periodDays', String(periodDays));
        if (strategyId) params.set('strategyId', strategyId);
        if (accountId) params.set('accountId', accountId);
        
        const res = await fetch(`/api/analytics/tiltmeter?${params}`);
        if (res.ok) {
          const score = await res.json();
          setData(score);
        }
      } catch (err) {
        console.error('Failed to fetch tiltmeter:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, [periodDays, strategyId, accountId]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!data) return null;

  const getTiltLabel = (score: number) => {
    if (score <= 20) return { text: 'Zen', emoji: '🧘', color: 'text-green-400', bg: 'bg-green-400', advice: 'Excellent discipline! Keep following your rules.' };
    if (score <= 40) return { text: 'Calm', emoji: '😌', color: 'text-green-300', bg: 'bg-green-300', advice: 'Minor slip-ups. Stay focused on your process.' };
    if (score <= 60) return { text: 'Edgy', emoji: '😐', color: 'text-yellow-400', bg: 'bg-yellow-400', advice: 'Some concerning patterns. Review your recent trades.' };
    if (score <= 80) return { text: 'Stressed', emoji: '😤', color: 'text-orange-400', bg: 'bg-orange-400', advice: 'Significant violations. Consider taking a break.' };
    return { text: 'Tilt', emoji: '🤯', color: 'text-red-400', bg: 'bg-red-400', advice: 'STOP TRADING. Step away and reset your mindset.' };
  };

  const tilt = getTiltLabel(data.score);
  const sortedComponents = Object.entries(data.components)
    .sort((a, b) => b[1].weightedScore - a[1].weightedScore);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          Tiltmeter
        </h3>
        <span className="text-xs text-gray-500">Last {periodDays} days</span>
      </div>

      {/* Main Score Display */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{tilt.emoji}</div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${tilt.color}`}>
              {tilt.text}
            </span>
            <span className="text-sm text-gray-400">
              {data.score}/100
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Based on {data.totalViolations} violation{data.totalViolations !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Visual meter bar */}
      <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-4">
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
        {/* Score markers */}
        <div className="absolute inset-0 flex justify-between px-1">
          {[20, 40, 60, 80].map(marker => (
            <div key={marker} className="w-px h-full bg-gray-600/50" />
          ))}
        </div>
      </div>

      {/* Advice */}
      <div className={`text-xs p-2 rounded mb-4 ${
        data.score <= 40 ? 'bg-green-400/10 text-green-300' :
        data.score <= 60 ? 'bg-yellow-400/10 text-yellow-300' :
        'bg-red-400/10 text-red-300'
      }`}>
        💡 {tilt.advice}
      </div>

      {/* Violation Breakdown */}
      {sortedComponents.length > 0 && (
        <div className="space-y-2">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <span>Violation Breakdown</span>
            <span className="text-xs">{expanded ? '▲' : '▼'}</span>
          </button>
          
          {sortedComponents.map(([type, info]) => {
            const ruleInfo = RULE_DESCRIPTIONS[type] || { label: formatRuleType(type), description: '', severity: 'medium' as const };
            const severityColors = {
              high: 'text-red-400',
              medium: 'text-yellow-400',
              low: 'text-gray-400',
            };
            
            return (
              <div key={type} className={`p-2 rounded bg-gray-700/50 ${expanded ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-200 font-medium">
                    {ruleInfo.label}
                  </span>
                  <span className={`text-xs font-bold ${severityColors[ruleInfo.severity]}`}>
                    {info.count}x
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ruleInfo.description}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${ruleInfo.severity === 'high' ? 'bg-red-400' : ruleInfo.severity === 'medium' ? 'bg-yellow-400' : 'bg-gray-400'}`}
                      style={{ width: `${Math.min(100, info.weightedScore * 10)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">
                    impact: {info.weightedScore.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Summary when collapsed */}
          {!expanded && (
            <div className="flex flex-wrap gap-2">
              {sortedComponents.slice(0, 3).map(([type, info]) => {
                const ruleInfo = RULE_DESCRIPTIONS[type] || { label: formatRuleType(type), severity: 'medium' as const };
                const severityColors = {
                  high: 'bg-red-400/20 text-red-400',
                  medium: 'bg-yellow-400/20 text-yellow-400',
                  low: 'bg-gray-600 text-gray-400',
                };
                return (
                  <span key={type} className={`px-2 py-1 rounded text-[10px] font-bold ${severityColors[ruleInfo.severity]}`}>
                    {ruleInfo.label} ({info.count})
                  </span>
                );
              })}
              {sortedComponents.length > 3 && (
                <span className="px-2 py-1 rounded text-[10px] text-gray-500 bg-gray-700">
                  +{sortedComponents.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* No violations state */}
      {sortedComponents.length === 0 && (
        <div className="text-center py-4 text-gray-500">
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
