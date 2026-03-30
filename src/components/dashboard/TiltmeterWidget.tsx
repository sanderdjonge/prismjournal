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

export default function TiltmeterWidget({ periodDays = 30, strategyId, accountId }: Props) {
  const [data, setData] = useState<TiltmeterScore | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (score <= 20) return { text: 'Zen', emoji: '🧘', color: 'text-green-400' };
    if (score <= 40) return { text: 'Calm', emoji: '😌', color: 'text-green-300' };
    if (score <= 60) return { text: 'Edgy', emoji: '😐', color: 'text-yellow-400' };
    if (score <= 80) return { text: 'Stressed', emoji: '😤', color: 'text-orange-400' };
    return { text: 'Tilt', emoji: '🤯', color: 'text-red-400' };
  };

  const tilt = getTiltLabel(data.score);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Tiltmeter
      </h3>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{tilt.emoji}</div>
        <div>
          <div className={`text-2xl font-bold ${tilt.color}`}>
            {tilt.text}
          </div>
          <div className="text-sm text-gray-400">
            Score: {data.score}/100
          </div>
        </div>
      </div>

      {/* Visual meter bar */}
      <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden mb-4">
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
      </div>

      {/* Top violation types */}
      {Object.keys(data.components).length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400">Top Violations:</div>
          {Object.entries(data.components)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3)
            .map(([type, info]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-gray-300">{formatRuleType(type)}</span>
                <span className="text-gray-400">{info.count}</span>
              </div>
            ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Last {periodDays} days • {data.totalViolations} total violations
      </div>
    </div>
  );
}

function formatRuleType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
