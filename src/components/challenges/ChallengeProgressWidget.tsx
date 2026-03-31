'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, X, ChevronRight, AlertTriangle, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChallenges, useCreateChallenge, type TradingChallenge, type ChallengeRule } from '@/hooks/useChallenges';

const RULE_LABELS: Record<string, string> = {
    MAX_DAILY_LOSS: 'Max Daily Loss',
    MAX_TRADES_PER_DAY: 'Max Trades/Day',
    MIN_RR: 'Min R:R',
    TIME_WINDOW: 'Trading Hours',
    MAX_DRAWDOWN: 'Max Drawdown',
    WIN_RATE_TARGET: 'Win Rate Target',
};

function RuleBadge({ rule }: { rule: ChallengeRule }) {
    const label = RULE_LABELS[rule.type] || rule.type;
    let valueDisplay = '';
    
    if (rule.type === 'MAX_DAILY_LOSS' || rule.type === 'MAX_DRAWDOWN') {
        valueDisplay = `$${rule.value}`;
    } else if (rule.type === 'MIN_RR' || rule.type === 'WIN_RATE_TARGET') {
        valueDisplay = `${rule.value}${rule.type === 'WIN_RATE_TARGET' ? '%' : ''}`;
    } else if (rule.type === 'MAX_TRADES_PER_DAY') {
        valueDisplay = `${rule.value}`;
    } else if (rule.type === 'TIME_WINDOW') {
        valueDisplay = String(rule.value);
    }
    
    return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
            {label}: {valueDisplay}
        </span>
    );
}

function ChallengeCard({ challenge, onClick }: { challenge: TradingChallenge; onClick: () => void }) {
    const successRate = challenge.totalDays > 0 
        ? (challenge.daysPassed / challenge.totalDays) * 100 
        : 0;
    
    return (
        <motion.button
            onClick={onClick}
            className="w-full text-left p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        challenge.isActive ? "bg-primary/20 text-primary" : "bg-gray-700 text-gray-500"
                    )}>
                        <Target size={14} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white">{challenge.name}</div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-wide">
                            {challenge.isActive ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                </div>
                <ChevronRight size={14} className="text-gray-600" />
            </div>
            
            {/* Rules */}
            <div className="flex flex-wrap gap-1 mb-2">
                {challenge.rules.slice(0, 3).map((rule, i) => (
                    <RuleBadge key={i} rule={rule} />
                ))}
                {challenge.rules.length > 3 && (
                    <span className="text-[9px] text-gray-500">+{challenge.rules.length - 3} more</span>
                )}
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className={cn(
                            "h-full rounded-full",
                            successRate >= 80 ? "bg-profit" : successRate >= 50 ? "bg-primary" : "bg-loss"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${successRate}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
                <span className="text-[10px] font-medium text-gray-400">
                    {challenge.daysPassed}/{challenge.totalDays}
                </span>
            </div>
        </motion.button>
    );
}

function CreateChallengeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState<ChallengeRule[]>([]);
    const createMutation = useCreateChallenge();
    
    const addRule = () => {
        setRules([...rules, { type: 'MAX_DAILY_LOSS', value: 0 }]);
    };
    
    const updateRule = (index: number, updates: Partial<ChallengeRule>) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...updates };
        setRules(newRules);
    };
    
    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };
    
    const handleSubmit = () => {
        if (!name || rules.length === 0) return;
        
        createMutation.mutate({
            name,
            description: description || undefined,
            rules,
            startDate: new Date().toISOString().split('T')[0],
        }, {
            onSuccess: () => {
                onClose();
                setName('');
                setDescription('');
                setRules([]);
            },
        });
    };
    
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
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg glass-card bg-[#0a0a0a] border-white/5 z-[101] shadow-2xl flex flex-col overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Target size={16} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">New Challenge</h2>
                                    <p className="text-[10px] text-gray-500">Define rules and track progress</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                    Challenge Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g., $200/day max loss"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="What's the goal?"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 resize-none h-16"
                                />
                            </div>
                            
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        Rules
                                    </label>
                                    <button
                                        onClick={addRule}
                                        className="text-[10px] font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                                    >
                                        <Plus size={12} />
                                        Add Rule
                                    </button>
                                </div>
                                
                                <div className="space-y-2">
                                    {rules.map((rule, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg">
                                            <select
                                                value={rule.type}
                                                onChange={e => updateRule(i, { type: e.target.value as ChallengeRule['type'] })}
                                                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                            >
                                                {Object.entries(RULE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={rule.value as number}
                                                onChange={e => updateRule(i, { value: parseFloat(e.target.value) || 0 })}
                                                className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
                                            />
                                            <button
                                                onClick={() => removeRule(i)}
                                                className="p-1 text-gray-500 hover:text-loss"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {rules.length === 0 && (
                                        <div className="text-center py-4 text-gray-600 text-xs">
                                            No rules added yet. Click "Add Rule" to start.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-white/5 flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!name || rules.length === 0 || createMutation.isPending}
                                className="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Challenge'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export function ChallengeProgressWidget() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { data: challenges, isLoading } = useChallenges(true); // Active only
    
    const activeChallenges = challenges?.filter(c => c.isActive) || [];
    
    return (
        <>
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="text-primary" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                            Challenges
                        </span>
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-600">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                    </div>
                ) : activeChallenges.length === 0 ? (
                    <div className="text-center py-6">
                        <Target size={24} className="mx-auto text-gray-700 mb-2" />
                        <p className="text-xs text-gray-600">No active challenges</p>
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="text-[10px] text-primary hover:text-primary/80 mt-2"
                        >
                            Create your first challenge
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeChallenges.slice(0, 3).map(challenge => (
                            <ChallengeCard
                                key={challenge.id}
                                challenge={challenge}
                                onClick={() => {/* TODO: Navigate to detail */}}
                            />
                        ))}
                        {activeChallenges.length > 3 && (
                            <div className="text-center pt-2">
                                <button className="text-[10px] text-primary hover:text-primary/80">
                                    View all {activeChallenges.length} challenges
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <CreateChallengeModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
        </>
    );
}