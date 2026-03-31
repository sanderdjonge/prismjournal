'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FlaskConical, X, ChevronDown, TrendingUp, TrendingDown, 
    Minus, Plus, RefreshCw, Calendar, Clock, Target, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useWhatIf, useWhatIfMulti, WhatIfFilters, WhatIfResult, SimulationResult } from '@/hooks/useWhatIf';

const DAYS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i.toString().padStart(2, '0') + ':00',
}));

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
            {label}
            <button onClick={onRemove} className="hover:text-white">
                <X size={12} />
            </button>
        </span>
    );
}

function MetricCard({ 
    label, 
    actual, 
    simulated, 
    format = 'number',
    prefix = '',
    suffix = ''
}: { 
    label: string; 
    actual: number; 
    simulated: number;
    format?: 'number' | 'percent' | 'currency';
    prefix?: string;
    suffix?: string;
}) {
    const diff = simulated - actual;
    const improved = diff > 0;
    
    const formatValue = (val: number) => {
        if (format === 'percent') return val.toFixed(1) + '%';
        if (format === 'currency') return '$' + val.toFixed(2);
        return val.toFixed(2);
    };
    
    return (
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{prefix}{formatValue(actual)}{suffix}</span>
                <span className="text-xs text-gray-500">→</span>
                <span className={cn(
                    "text-lg font-bold",
                    improved ? "text-profit" : diff < 0 ? "text-loss" : "text-gray-400"
                )}>
                    {prefix}{formatValue(simulated)}{suffix}
                </span>
            </div>
            {diff !== 0 && (
                <div className={cn(
                    "flex items-center gap-1 mt-1 text-xs",
                    improved ? "text-profit" : "text-loss"
                )}>
                    {improved ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff > 0 ? '+' : ''}{formatValue(diff)}
                </div>
            )}
        </div>
    );
}

function ComparisonSummary({ result }: { result: WhatIfResult }) {
    const { actual, simulated, difference } = result;
    
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard 
                label="Total Trades" 
                actual={actual.totalTrades} 
                simulated={simulated.totalTrades}
                format="number"
            />
            <MetricCard 
                label="Total P&L" 
                actual={actual.totalPnl} 
                simulated={simulated.totalPnl}
                format="currency"
            />
            <MetricCard 
                label="Win Rate" 
                actual={actual.winRate} 
                simulated={simulated.winRate}
                format="percent"
            />
            <MetricCard 
                label="Profit Factor" 
                actual={actual.profitFactor} 
                simulated={simulated.profitFactor}
                format="number"
            />
        </div>
    );
}

export function WhatIfSimulator() {
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<WhatIfFilters>({});
    const [activeFilters, setActiveFilters] = useState<WhatIfFilters | null>(null);
    
    const { data: result, isLoading, refetch } = useWhatIf(activeFilters);
    
    const handleRunSimulation = () => {
        setActiveFilters({ ...filters });
    };
    
    const handleClearFilters = () => {
        setFilters({});
        setActiveFilters(null);
    };
    
    const activeFilterCount = useMemo(() => {
        return Object.values(filters).filter(v => 
            v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
        ).length;
    }, [filters]);
    
    return (
        <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FlaskConical className="text-primary" size={18} />
                    <span className="text-sm font-semibold text-white">What-If Simulator</span>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
                >
                    {activeFilterCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-black text-xs font-bold flex items-center justify-center">
                            {activeFilterCount}
                        </span>
                    )}
                    <span>Filters</span>
                    <ChevronDown size={14} className={cn(
                        "transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </button>
            </div>
            
            {/* Filter Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05] mb-4 space-y-4">
                            {/* Day Filter */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Exclude Days
                                </label>
                                <div className="flex flex-wrap gap-1">
                                    {DAYS.map(day => (
                                        <button
                                            key={day.value}
                                            onClick={() => {
                                                const current = filters.excludeDays || [];
                                                const updated = current.includes(day.value)
                                                    ? current.filter(d => d !== day.value)
                                                    : [...current, day.value];
                                                setFilters({ ...filters, excludeDays: updated.length > 0 ? updated : undefined });
                                            }}
                                            className={cn(
                                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                                filters.excludeDays?.includes(day.value)
                                                    ? "bg-primary text-black"
                                                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                                            )}
                                        >
                                            {day.label.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Hour Filter */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Exclude Hours
                                </label>
                                <div className="flex flex-wrap gap-1">
                                    {HOURS.slice(6, 22).map(hour => (
                                        <button
                                            key={hour.value}
                                            onClick={() => {
                                                const current = filters.excludeHours || [];
                                                const updated = current.includes(hour.value)
                                                    ? current.filter(h => h !== hour.value)
                                                    : [...current, hour.value];
                                                setFilters({ ...filters, excludeHours: updated.length > 0 ? updated : undefined });
                                            }}
                                            className={cn(
                                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                                filters.excludeHours?.includes(hour.value)
                                                    ? "bg-primary text-black"
                                                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                                            )}
                                        >
                                            {hour.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* R:R Filter */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                        Min R:R
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={filters.minRR ?? ''}
                                        onChange={e => setFilters({ 
                                            ...filters, 
                                            minRR: e.target.value ? parseFloat(e.target.value) : undefined 
                                        })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/40"
                                        placeholder="0.0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                        Max R:R
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={filters.maxRR ?? ''}
                                        onChange={e => setFilters({ 
                                            ...filters, 
                                            maxRR: e.target.value ? parseFloat(e.target.value) : undefined 
                                        })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/40"
                                        placeholder="10.0"
                                    />
                                </div>
                            </div>
                            
                            {/* Profit Filter */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                        Min Profit ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="10"
                                        value={filters.minProfit ?? ''}
                                        onChange={e => setFilters({ 
                                            ...filters, 
                                            minProfit: e.target.value ? parseFloat(e.target.value) : undefined 
                                        })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/40"
                                        placeholder="-1000"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                                        Max Profit ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="10"
                                        value={filters.maxProfit ?? ''}
                                        onChange={e => setFilters({ 
                                            ...filters, 
                                            maxProfit: e.target.value ? parseFloat(e.target.value) : undefined 
                                        })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/40"
                                        placeholder="1000"
                                    />
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <button
                                    onClick={handleClearFilters}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    Clear all
                                </button>
                                <button
                                    onClick={handleRunSimulation}
                                    disabled={activeFilterCount === 0 || isLoading}
                                    className="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw size={12} className="animate-spin" />
                                            Running...
                                        </span>
                                    ) : 'Run Simulation'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Active Filter Chips */}
            {activeFilterCount > 0 && !isOpen && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {filters.excludeDays?.map(d => (
                        <FilterChip 
                            key={`day-${d}`} 
                            label={`No ${DAYS.find(day => day.value === d)?.label}`} 
                            onRemove={() => setFilters({
                                ...filters,
                                excludeDays: filters.excludeDays?.filter(x => x !== d)
                            })}
                        />
                    ))}
                    {filters.minRR !== undefined && (
                        <FilterChip 
                            label={`R:R ≥ ${filters.minRR}`} 
                            onRemove={() => setFilters({ ...filters, minRR: undefined })}
                        />
                    )}
                    {filters.maxRR !== undefined && (
                        <FilterChip 
                            label={`R:R ≤ ${filters.maxRR}`} 
                            onRemove={() => setFilters({ ...filters, maxRR: undefined })}
                        />
                    )}
                </div>
            )}
            
            {/* Results */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <RefreshCw size={24} className="animate-spin text-primary" />
                </div>
            )}
            
            {!isLoading && !result && (
                <div className="text-center py-8">
                    <FlaskConical size={32} className="mx-auto text-gray-700 mb-2" />
                    <p className="text-sm text-gray-500">Apply filters and run simulation</p>
                    <p className="text-xs text-gray-600 mt-1">See how your P&L would change with different rules</p>
                </div>
            )}
            
            {!isLoading && result && (
                <ComparisonSummary result={result} />
            )}
        </div>
    );
}