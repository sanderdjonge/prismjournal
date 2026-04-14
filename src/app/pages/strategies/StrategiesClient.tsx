'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X, Target, AlertTriangle } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import ChecklistManager from '@/components/strategies/ChecklistManager';
import { EmptyState } from '@/components/ui/EmptyState';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    trades: number;
    violations: number;
  };
  adherenceScore: number;
  tiltmeterScore: number;
}

interface Props {
  strategies: Strategy[];
}

export default function StrategiesClient({ strategies: initialStrategies }: Props) {
  const router = useRouter();
  const [strategies, setStrategies] = useState(initialStrategies);
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newStrategy, setNewStrategy] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newStrategy.name.trim()) {
      setError('Strategy name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStrategy),
      });

      if (res.ok) {
        const data = await res.json();
        setStrategies(prev => [{ 
          ...data.strategy, 
          _count: { trades: 0, violations: 0 },
          adherenceScore: 100,
          tiltmeterScore: 0
        }, ...prev]);
        setShowModal(false);
        setNewStrategy({ name: '', description: '' });
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create strategy');
      }
    } catch (err) {
      setError('Failed to create strategy');
    } finally {
      setIsCreating(false);
    }
  }

  function getAdherenceColor(score: number): string {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function getTiltmeterColor(score: number): string {
    if (score <= 20) return 'text-green-400';
    if (score <= 40) return 'text-green-300';
    if (score <= 60) return 'text-yellow-400';
    if (score <= 80) return 'text-orange-400';
    return 'text-red-400';
  }

  function getTiltmeterEmoji(score: number): string {
    if (score <= 20) return '🧘';
    if (score <= 40) return '😌';
    if (score <= 60) return '😐';
    if (score <= 80) return '😤';
    return '🤯';
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Strategies</h1>
            <p className="text-sm text-gray-400 mt-1">
              Define trading rules and track strategy compliance
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg transition-colors text-sm"
          >
            <Plus size={16} />
            Create Strategy
          </button>
        </div>

        {strategies.length === 0 ? (
          <div className="glass-card p-12 border-white/5 text-center">
            <EmptyState
              icon={Target}
              title="No strategies found."
              description="Create your first strategy to define trading rules and track compliance."
              action={
                <button
                  onClick={() => setShowModal(true)}
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-bold"
                >
                  Create your first strategy →
                </button>
              }
              className="py-0"
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map(strategy => (
              <Link
                key={strategy.id}
                href={`/pages/strategies/${strategy.id}`}
                className="glass-card p-5 border-white/5 hover:border-primary/20 hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{strategy.name}</h3>
                    {strategy.description && (
                      <p className="text-gray-400 text-sm mt-1 truncate">{strategy.description}</p>
                    )}
                    <div className="text-sm text-gray-500 mt-2">
                      <span className="font-mono">{strategy._count.trades}</span>
                      <span className="text-gray-600 ml-1">trades</span>
                    </div>
                  </div>
                  
                  {/* Metrics Grid */}
                  <div className="flex gap-4 shrink-0">
                    {/* Adherence */}
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Target size={14} className="text-gray-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Adherence</span>
                      </div>
                      <div className={`text-2xl font-black ${getAdherenceColor(strategy.adherenceScore)}`}>
                        {strategy.adherenceScore}%
                      </div>
                    </div>
                    
                    {/* Tiltmeter */}
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tilt</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xl">{getTiltmeterEmoji(strategy.tiltmeterScore)}</span>
                        <span className={`text-lg font-bold ${getTiltmeterColor(strategy.tiltmeterScore)}`}>
                          {strategy.tiltmeterScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Violations indicator */}
                {strategy._count.violations > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs">
                    <AlertTriangle size={12} className="text-red-400" />
                    <span className="text-red-400 font-medium">
                      {strategy._count.violations} rule violation{strategy._count.violations !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Checklists section */}
        <div className="glass-card p-6 border-white/5">
          <ChecklistManager />
        </div>
      </div>

      {/* Create Strategy Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md mx-4 p-6 border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Create Strategy</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Name *</label>
                <input
                  type="text"
                  value={newStrategy.name}
                  onChange={e => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors"
                  placeholder="e.g., ICT FVG Strategy"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Description</label>
                <textarea
                  value={newStrategy.description}
                  onChange={e => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-sm font-bold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
                >
                  {isCreating ? 'Creating...' : 'Create Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}