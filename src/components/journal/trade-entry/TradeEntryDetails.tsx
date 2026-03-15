'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Zap, Brain, FileText, CheckCircle2, XCircle, Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MOOD_SELECTOR_OPTIONS } from '@/constants/tradeConfig';

interface Strategy {
    id: string;
    name: string;
    description?: string | null;
    _count?: { trades: number };
}

interface TradeEntryDetailsProps {
    strategy: string;
    onStrategyChange: (value: string) => void;
    compliance: boolean | null;
    onComplianceChange: (value: boolean | null) => void;
    mood: string;
    onMoodChange: (value: string) => void;
    notes: string;
    onNotesChange: (value: string) => void;
    disabled?: boolean;
}

const DEFAULT_STRATEGIES = [
    'Vector Momentum (H1)',
    'Range Liquidity Sweep',
    'News Event Volatility',
    'Mean Reversion (M15)',
    'Other / Experimental'
];


export function TradeEntryDetails({
    strategy,
    onStrategyChange,
    compliance,
    onComplianceChange,
    mood,
    onMoodChange,
    notes,
    onNotesChange,
    disabled = false,
}: TradeEntryDetailsProps) {
    const [customStrategies, setCustomStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewStrategy, setShowNewStrategy] = useState(false);
    const [newStrategyName, setNewStrategyName] = useState('');
    const [newStrategyDesc, setNewStrategyDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Load custom strategies
    useEffect(() => {
        async function loadStrategies() {
            try {
                const res = await fetch('/api/strategies');
                if (res.ok) {
                    const data = await res.json();
                    setCustomStrategies(data.strategies || []);
                }
            } catch {
                // silently ignore
            } finally {
                setLoading(false);
            }
        }
        loadStrategies();
    }, []);

    // Focus input when showing new strategy form
    useEffect(() => {
        if (showNewStrategy && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showNewStrategy]);

    const handleCreateStrategy = async () => {
        if (!newStrategyName.trim()) {
            setError('Strategy name is required');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/strategies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newStrategyName.trim(),
                    description: newStrategyDesc.trim() || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create strategy');
            }

            const { strategy: newStrat } = await res.json();
            setCustomStrategies(prev => [...prev, newStrat]);
            onStrategyChange(newStrat.name);
            setNewStrategyName('');
            setNewStrategyDesc('');
            setShowNewStrategy(false);
        } catch (e: any) {
            setError(e.message || 'Failed to create strategy');
        } finally {
            setSaving(false);
        }
    };

    // Combine default and custom strategies
    const allStrategies = [...DEFAULT_STRATEGIES, ...customStrategies.map(s => s.name)];

    return (
        <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                        <Zap size={10} /> Strategy
                    </label>
                    
                    {!showNewStrategy ? (
                        <div className="space-y-2">
                            <select 
                                value={strategy} 
                                onChange={e => onStrategyChange(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                disabled={loading}
                            >
                                {DEFAULT_STRATEGIES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                                {customStrategies.length > 0 && (
                                    <optgroup label="Custom Strategies">
                                        {customStrategies.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowNewStrategy(true)}
                                className="w-full p-2 rounded-lg border border-dashed border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Plus size={12} /> Create Custom Strategy
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">New Strategy</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNewStrategy(false);
                                        setNewStrategyName('');
                                        setNewStrategyDesc('');
                                        setError('');
                                    }}
                                    className="text-gray-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={newStrategyName}
                                onChange={e => setNewStrategyName(e.target.value)}
                                placeholder="Strategy name..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-primary/50"
                            />
                            <input
                                type="text"
                                value={newStrategyDesc}
                                onChange={e => setNewStrategyDesc(e.target.value)}
                                placeholder="Description (optional)..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-primary/50"
                            />
                            {error && <p className="text-danger text-[10px]">{error}</p>}
                            <button
                                type="button"
                                onClick={handleCreateStrategy}
                                disabled={saving || !newStrategyName.trim()}
                                className="w-full p-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                {saving ? 'Creating...' : 'Create Strategy'}
                            </button>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Plan Compliance</label>
                    <div className="flex gap-3">
                        <button 
                            type="button"
                            onClick={() => onComplianceChange(true)}
                            className={cn(
                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest",
                                compliance === true 
                                    ? "bg-accent/10 border-accent/40 text-accent" 
                                    : "bg-white/5 border-transparent text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <CheckCircle2 size={14} /> Followed
                        </button>
                        <button 
                            type="button"
                            onClick={() => onComplianceChange(false)}
                            className={cn(
                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest",
                                compliance === false 
                                    ? "bg-danger/10 border-danger/40 text-danger" 
                                    : "bg-white/5 border-transparent text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <XCircle size={14} /> Deviated
                        </button>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                        <Brain size={10} /> Psychological State
                    </label>
                    <div className="flex gap-2">
                        {MOOD_SELECTOR_OPTIONS.map((m) => (
                            <button 
                                type="button"
                                key={m.id} 
                                onClick={() => onMoodChange(m.id)}
                                className={cn(
                                    "flex-1 p-3 rounded-xl border flex flex-col items-center gap-1 transition-all",
                                    mood === m.id 
                                        ? cn(m.bg, "border-white/20 scale-105") 
                                        : "bg-white/5 border-transparent opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
                                )}
                            >
                                <m.icon size={18} className={m.color} />
                                <span className="text-[8px] font-black uppercase tracking-widest text-white">{m.id}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                        <FileText size={10} /> Notes
                    </label>
                    <textarea 
                        value={notes} 
                        onChange={e => onNotesChange(e.target.value)}
                        className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-primary/50 transition-all resize-none"
                        placeholder="Market context, entry rationale..." 
                    />
                </div>
            </div>
        </div>
    );
}
