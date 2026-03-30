'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    trades: number;
    violations: number;
  };
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
        setStrategies(prev => [{ ...data.strategy, _count: { trades: 0, violations: 0 } }, ...prev]);
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
            <div className="text-gray-400 mb-4">No strategies found.</div>
            <p className="text-gray-500 text-sm mb-6">
              Create your first strategy to define trading rules and track compliance.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-primary hover:text-primary/80 transition-colors text-sm font-bold"
            >
              Create your first strategy →
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map(strategy => (
              <Link
                key={strategy.id}
                href={`/pages/strategies/${strategy.id}`}
                className="glass-card p-5 border-white/5 hover:border-primary/20 hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{strategy.name}</h3>
                    {strategy.description && (
                      <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-400">
                      <span className="font-mono">{strategy._count.trades}</span>
                      <span className="text-gray-600 ml-1">trades</span>
                    </div>
                    {strategy._count.violations > 0 && (
                      <div className="text-red-400 text-xs mt-1">{strategy._count.violations} violations</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
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