'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '@/components/layout/DashboardShell';
import StrategyRulesEditor from '@/components/strategies/StrategyRulesEditor';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';
import TiltmeterWidget from '@/components/dashboard/TiltmeterWidget';
import { ArrowLeft } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    trades: number;
  };
  trades: Array<{
    id: string;
    pnl: number | null;
    exitTime: Date | null;
  }>;
}

export default function StrategyDetailClient() {
  const params = useParams();
  const router = useRouter();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchStrategy();
    }
  }, [params.id]);

  async function fetchStrategy() {
    try {
      const res = await fetch(`/api/strategies/${params.id}`);
      if (res.ok) {
        setStrategy(await res.json());
      } else {
        router.push('/pages/strategies');
      }
    } catch (err) {
      console.error('Failed to fetch strategy:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="animate-pulse p-6">Loading strategy...</div>
      </DashboardShell>
    );
  }

  if (!strategy) {
    return (
      <DashboardShell>
        <div className="p-6 text-gray-400">Strategy not found</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Back link + Header */}
        <div>
          <Link
            href="/pages/strategies"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back to Strategies</span>
          </Link>
          <h1 className="text-2xl font-bold">{strategy.name}</h1>
          {strategy.description && (
            <p className="text-gray-400 mt-1">{strategy.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules Editor - Main Column */}
          <div className="lg:col-span-2 bg-gray-900 rounded-lg p-6">
            <StrategyRulesEditor strategyId={strategy.id} />
          </div>

          {/* Sidebar with widgets */}
          <div className="space-y-6">
            <ComplianceWidget periodDays={30} />
            <TiltmeterWidget periodDays={30} />
            
            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Strategy Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Trades</span>
                  <span>{strategy._count.trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created</span>
                  <span>{new Date(strategy.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        {strategy.trades && strategy.trades.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Closed Trades</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.trades.map(trade => (
                    <tr key={trade.id} className="border-t border-gray-800">
                      <td className="py-2">
                        {trade.exitTime?.toLocaleDateString() || '—'}
                      </td>
                      <td className={`py-2 ${trade.pnl && trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}