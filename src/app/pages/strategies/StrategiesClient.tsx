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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Strategies</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Create Strategy
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">No strategies found.</div>
          <button
            onClick={() => setShowModal(true)}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Create your first strategy
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {strategies.map(strategy => (
            <Link
              key={strategy.id}
              href={`/pages/strategies/${strategy.id}`}
              className="block bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{strategy.name}</h3>
                  {strategy.description && (
                    <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-400">
                  <div>{strategy._count.trades} trades</div>
                  {strategy._count.violations > 0 && (
                    <div className="text-red-400">{strategy._count.violations} violations</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Strategy Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create Strategy</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newStrategy.name}
                  onChange={e => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:border-primary focus:outline-none"
                  placeholder="e.g., ICT FVG Strategy"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={newStrategy.description}
                  onChange={e => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:border-primary focus:outline-none resize-none"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}