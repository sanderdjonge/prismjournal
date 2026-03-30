'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '@/components/layout/DashboardShell';
import StrategyRulesEditor from '@/components/strategies/StrategyRulesEditor';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';
import TiltmeterWidget from '@/components/dashboard/TiltmeterWidget';
import { ArrowLeft, Edit2, Trash2, X, Check, Loader2, RefreshCw } from 'lucide-react';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [reevaluateResult, setReevaluateResult] = useState<{ evaluated: number; violations: number } | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchStrategy();
    }
  }, [params.id]);

  async function fetchStrategy() {
    try {
      const res = await fetch(`/api/strategies/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setStrategy(data);
        setEditName(data.name);
        setEditDescription(data.description || '');
      } else {
        router.push('/pages/strategies');
      }
    } catch (err) {
      console.error('Failed to fetch strategy:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!strategy || !editName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStrategy(prev => prev ? { ...prev, name: updated.name, description: updated.description } : null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update strategy:', err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!strategy) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/pages/strategies');
      }
    } catch (err) {
      console.error('Failed to delete strategy:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleReevaluate() {
    if (!strategy) return;
    setIsReevaluating(true);
    setReevaluateResult(null);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}/re-evaluate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReevaluateResult({ evaluated: data.tradesEvaluated, violations: data.totalViolations });
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to re-evaluate:', err);
    } finally {
      setIsReevaluating(false);
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
            className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-4 text-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Strategies</span>
          </Link>
          
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white w-full max-w-md focus:border-primary/50 focus:outline-none"
                placeholder="Strategy name"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-primary/50 focus:outline-none resize-none"
                placeholder="Description (optional)"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(strategy.name);
                    setEditDescription(strategy.description || '');
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{strategy.name}</h1>
                {strategy.description && (
                  <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReevaluate}
                  disabled={isReevaluating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isReevaluating ? 'animate-spin' : ''} />
                  {isReevaluating ? 'Evaluating...' : 'Re-evaluate'}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Edit2 size={14} />
                  Rename
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
              {reevaluateResult && (
                <p className="text-sm text-gray-400 mt-2">
                  ✓ Evaluated {reevaluateResult.evaluated} trades, found {reevaluateResult.violations} violations
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules Editor - Main Column */}
          <div className="lg:col-span-2 glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            <StrategyRulesEditor strategyId={strategy.id} />
          </div>

          {/* Sidebar with widgets */}
          <div className="space-y-6">
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
              <ComplianceWidget periodDays={30} strategyId={strategy.id} />
            </div>
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
              <TiltmeterWidget periodDays={30} strategyId={strategy.id} />
            </div>
            
            {/* Quick Stats */}
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Strategy Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Total Trades</span>
                  <span className="font-mono text-white">{strategy._count.trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Created</span>
                  <span className="text-gray-400 text-sm">{new Date(strategy.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        {strategy.trades && strategy.trades.length > 0 && (
          <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4">Recent Closed Trades</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.trades.map(trade => (
                    <tr key={trade.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 text-gray-400">
                        {trade.exitTime ? new Date(trade.exitTime).toLocaleDateString() : '—'}
                      </td>
                      <td className={`py-3 font-mono ${trade.pnl && trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md mx-4 p-6 border-loss/30">
            <h2 className="text-xl font-bold text-white mb-2">Delete Strategy?</h2>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete "{strategy?.name}". Trades linked to this strategy will be unlinked but not deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-sm font-bold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Strategy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}