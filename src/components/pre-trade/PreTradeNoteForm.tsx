'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PreTradeNoteFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    compact?: boolean;
}

export function PreTradeNoteForm({ onSuccess, onCancel, compact = false }: PreTradeNoteFormProps) {
    const [symbol, setSymbol] = useState('');
    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [body, setBody] = useState('');
    const [plannedEntry, setPlannedEntry] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol.trim() || !body.trim()) {
            setError('Symbol and analysis are required');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/pre-trade-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol.toUpperCase(),
                    direction,
                    body,
                    plannedEntry: plannedEntry ? parseFloat(plannedEntry) : undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create note');
            }

            // Reset form
            setSymbol('');
            setBody('');
            setPlannedEntry('');
            setDirection('LONG');
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create note');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={cn(
            "bg-surface-elevated border border-border-color rounded-xl",
            compact ? "p-4" : "p-6"
        )}>
            {!compact && (
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-100">New Pre-Trade Note</h3>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-text-muted hover:text-text-secondary transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-4">
                {/* Symbol and Direction Row */}
                <div className="flex gap-3">
                    {/* Symbol Input */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-text-muted mb-1.5">
                            Symbol
                        </label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            placeholder="e.g., EURUSD"
                            className="w-full px-3 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                        />
                    </div>

                    {/* Direction Toggle */}
                    <div className="w-32">
                        <label className="block text-xs font-medium text-text-muted mb-1.5">
                            Direction
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-border-color">
                            <button
                                type="button"
                                onClick={() => setDirection('LONG')}
                                className={cn(
                                    "flex-1 px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors",
                                    direction === 'LONG'
                                        ? "bg-profit/20 text-profit"
                                        : "bg-surface-elevated text-text-muted hover:text-text-secondary"
                                )}
                            >
                                <ArrowUpRight size={12} />
                                Long
                            </button>
                            <button
                                type="button"
                                onClick={() => setDirection('SHORT')}
                                className={cn(
                                    "flex-1 px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors",
                                    direction === 'SHORT'
                                        ? "bg-loss/20 text-loss"
                                        : "bg-surface-elevated text-text-muted hover:text-text-secondary"
                                )}
                            >
                                <ArrowDownRight size={12} />
                                Short
                            </button>
                        </div>
                    </div>
                </div>

                {/* Planned Entry (Optional) */}
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                        Planned Entry <span className="text-text-muted">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={plannedEntry}
                        onChange={(e) => setPlannedEntry(e.target.value)}
                        placeholder="e.g., 1.0850"
                        className="w-full px-3 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                </div>

                {/* Analysis Body */}
                <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                        Analysis / Thesis
                    </label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Describe your trade idea, setup, reasoning..."
                        rows={compact ? 3 : 4}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="text-xs text-loss bg-loss/10 px-3 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-xs font-medium text-text-muted hover:text-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !symbol.trim() || !body.trim()}
                        className={cn(
                            "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                            "bg-primary hover:bg-primary/90 text-black",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "flex items-center gap-2"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Note'
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}