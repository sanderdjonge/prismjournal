'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, CheckCircle2, XCircle, AlertTriangle, Calendar, TrendingUp, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/formatNumber';
import { useCurrency } from '@/lib/currency';
import { useChallenge, useDeleteChallenge, useUpdateChallenge, useBackfillChallenge, type ChallengeRule, type ChallengeEvaluation } from '@/hooks/useChallenges';
import { useState } from 'react';

const RULE_LABELS: Record<string, string> = {
    MAX_DAILY_LOSS: 'Max Daily Loss',
    MAX_TRADES_PER_DAY: 'Max Trades/Day',
    MIN_RR: 'Min R:R',
    TIME_WINDOW: 'Trading Hours',
    MAX_DRAWDOWN: 'Max Drawdown',
    WIN_RATE_TARGET: 'Win Rate Target',
};

function RuleBadge({ rule }: { rule: ChallengeRule }) {
    const { formatAmount: fmt } = useCurrency()
    const label = RULE_LABELS[rule.type] || rule.type;
    let valueDisplay = '';
    
    if (rule.type === 'MAX_DAILY_LOSS' || rule.type === 'MAX_DRAWDOWN') {
        valueDisplay = fmt(Number(rule.value));
    } else if (rule.type === 'MIN_RR' || rule.type === 'WIN_RATE_TARGET') {
        valueDisplay = `${rule.value}${rule.type === 'WIN_RATE_TARGET' ? '%' : ''}`;
    } else if (rule.type === 'MAX_TRADES_PER_DAY') {
        valueDisplay = `${rule.value}`;
    } else if (rule.type === 'TIME_WINDOW') {
        valueDisplay = String(rule.value);
    }
    
    return (
        <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/10">
            {label}: {valueDisplay}
        </span>
    );
}

function EvaluationDay({ evaluation, index }: { evaluation: ChallengeEvaluation; index: number }) {
    const date = new Date(evaluation.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    
    return (
        <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg",
            evaluation.passed ? "bg-profit/5" : "bg-loss/5"
        )}>
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                evaluation.passed ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"
            )}>
                {evaluation.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">
                        {dayName}, {month} {dayNum}
                    </span>
                    <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                        evaluation.passed ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"
                    )}>
                        {evaluation.passed ? 'PASS' : 'FAIL'}
                    </span>
                </div>
                {evaluation.failureReasons && evaluation.failureReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {evaluation.failureReasons.map((reason, i) => (
                            <span key={i} className="text-[9px] text-loss/80 bg-loss/10 px-1.5 py-0.5 rounded">
                                {reason}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className="text-[10px] text-gray-500">
                {evaluation.tradeIds.length} trade{evaluation.tradeIds.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
}

export function ChallengeDetailModal({ 
    challengeId, 
    isOpen, 
    onClose,
    onDelete 
}: { 
    challengeId: string | null; 
    isOpen: boolean; 
    onClose: () => void;
    onDelete?: () => void;
}) {
    const { data: challenge, isLoading, refetch } = useChallenge(isOpen ? challengeId : null);
    const deleteMutation = useDeleteChallenge(challengeId || '');
    const backfillMutation = useBackfillChallenge(challengeId || '');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    useEffect(() => {
        if (isOpen && challengeId) {
            refetch();
        }
    }, [isOpen, challengeId, refetch]);
    
    const handleDelete = () => {
        deleteMutation.mutate(undefined, {
            onSuccess: () => {
                onClose();
                onDelete?.();
            }
        });
    };
    
    const handleBackfill = () => {
        backfillMutation.mutate(undefined, {
            onSuccess: () => {
                refetch();
            }
        });
    };
    
    if (!challengeId) return null;
    
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] glass-card bg-surface border-border-subtle z-[101] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                            </div>
                        ) : challenge ? (
                            <>
                                {/* Header */}
                                <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center",
                                            challenge.isActive ? "bg-primary/20 text-primary" : "bg-gray-800 text-gray-500"
                                        )}>
                                            <Target size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">{challenge.name}</h2>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wide",
                                                    challenge.isActive ? "text-primary" : "text-gray-500"
                                                )}>
                                                    {challenge.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                {challenge.description && (
                                                    <span className="text-[10px] text-gray-500">• {challenge.description}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {showDeleteConfirm ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleDelete}
                                                    disabled={deleteMutation.isPending}
                                                    className="px-3 py-1.5 bg-loss text-white text-xs font-bold rounded-lg hover:bg-loss/80"
                                                >
                                                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleBackfill}
                                                    disabled={backfillMutation.isPending}
                                                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-primary transition-colors"
                                                    title="Backfill evaluations from historical trades"
                                                >
                                                    <RefreshCw size={16} className={backfillMutation.isPending ? 'animate-spin' : ''} />
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-loss transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Stats */}
                                <div className="p-4 border-b border-border-subtle grid grid-cols-4 gap-3">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-white">{challenge.stats.totalDays}</div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wide">Total Days</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-profit">{challenge.stats.passedDays}</div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wide">Passed</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-loss">{challenge.stats.failedDays}</div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wide">Failed</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={cn(
                                            "text-2xl font-bold",
                                            challenge.stats.successRate >= 80 ? "text-profit" : 
                                            challenge.stats.successRate >= 50 ? "text-primary" : "text-loss"
                                        )}>
                                            {formatPercent(challenge.stats.successRate, 0)}
                                        </div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wide">Success</div>
                                    </div>
                                </div>
                                
                                {/* Rules */}
                                <div className="px-4 py-3 border-b border-border-subtle">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Rules</div>
                                    <div className="flex flex-wrap gap-2">
                                        {challenge.rules.map((rule, i) => (
                                            <RuleBadge key={i} rule={rule} />
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Evaluation Log */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                                        <Calendar size={12} />
                                        Evaluation Log
                                    </div>
                                    
                                    {challenge.evaluations.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Calendar size={32} className="mx-auto text-gray-700 mb-2" />
                                            <p className="text-xs text-gray-600">No evaluations yet</p>
                                            <p className="text-[10px] text-gray-700 mt-1">Evaluations appear when trades are synced</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {challenge.evaluations
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((evaluation, i) => (
                                                    <EvaluationDay key={evaluation.id} evaluation={evaluation} index={i} />
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <p className="text-gray-500">Challenge not found</p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}