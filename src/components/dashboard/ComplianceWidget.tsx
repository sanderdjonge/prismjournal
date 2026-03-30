'use client';

import { useEffect, useState } from 'react';

interface ComplianceStats {
  totalTrades: number;
  compliantTrades: number;
  violationCount: number;
  adherenceRate: number;
  costOfViolations: number;
  violationsByType: Record<string, number>;
}

interface Props {
  periodDays?: number;
  strategyId?: string;
  accountId?: string;
}

export default function ComplianceWidget({ periodDays = 30, strategyId, accountId }: Props) {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams();
        params.set('periodDays', String(periodDays));
        if (strategyId) params.set('strategyId', strategyId);
        if (accountId) params.set('accountId', accountId);
        
        const res = await fetch(`/api/analytics/compliance?${params}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch compliance stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [periodDays, strategyId, accountId]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-700 rounded w-1/3"></div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">
        Plan Adherence
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className={`text-3xl font-bold ${getAdherenceColor(stats.adherenceRate)}`}>
            {stats.adherenceRate}%
          </div>
          <div className="text-sm text-gray-400">Adherence Rate</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-100">
            {stats.violationCount}
          </div>
          <div className="text-sm text-gray-400">Violations</div>
        </div>
      </div>

      {stats.costOfViolations > 0 && (
        <div className="mt-4 p-3 bg-red-900/30 rounded border border-red-800">
          <div className="text-sm text-red-300">
            Deviating from your plan cost you
          </div>
          <div className="text-xl font-bold text-red-400">
            ${stats.costOfViolations.toFixed(2)}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Last {periodDays} days • {stats.totalTrades} trades
      </div>
    </div>
  );
}
