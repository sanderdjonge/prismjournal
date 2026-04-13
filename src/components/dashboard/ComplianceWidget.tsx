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
      <div className="glass-card rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-surface-elevated rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-surface-elevated rounded w-1/3"></div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return 'text-profit';
    if (rate >= 70) return 'text-warning';
    return 'text-loss';
  };

  return (
    <div className="glass-card rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Plan Adherence
        </h3>
        <p className="text-xs text-text-muted">Last {periodDays} days</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className={`text-3xl font-bold ${getAdherenceColor(stats.adherenceRate)}`}>
            {stats.adherenceRate}%
          </div>
          <div className="text-sm text-text-secondary">Adherence Rate</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-text-primary">
            {stats.violationCount}
          </div>
          <div className="text-sm text-text-secondary">Violations</div>
        </div>
      </div>

      {stats.costOfViolations > 0 && (
        <div className="mt-4 p-3 bg-loss-bg rounded border border-loss-border">
          <div className="text-xs text-loss">
            Deviating from your plan cost you
          </div>
          <div className="text-lg font-bold text-loss">
            ${stats.costOfViolations.toFixed(2)}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-text-muted">
        {stats.totalTrades} trades
      </div>
    </div>
  );
}
