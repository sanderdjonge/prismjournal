'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FlaskConical, X, ChevronDown, TrendingUp, TrendingDown, 
    Minus, Plus, RefreshCw, Calendar, Clock, Target, DollarSign,
    Settings2
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useWhatIf, useWhatIfMulti, WhatIfFilters, WhatIfResult, SimulationResult } from '@/hooks/useWhatIf';
import { useSettings } from '@/hooks/useSettings';
import {
  DurationFilterConfig,
  MarketSessionConfig,
  LossLimitConfig,
  StreakBreakConfig,
  BigLossCooldownConfig,
  PositionSizingConfig,
  TrailingStopConfig,
  VolatilityConfig,
  NewsEventConfig,
} from '@/components/what-if/WhatIfFilterChips';

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
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary transition-all">
            {label}
            <button
                onClick={onRemove}
                className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 hover:text-white"
                aria-label={`Remove ${label} filter`}
            >
                <X size={10} />
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
    suffix = '',
    currency = 'USD'
}: {
    label: string;
    actual: number;
    simulated: number;
    format?: 'number' | 'percent' | 'currency';
    prefix?: string;
    suffix?: string;
    currency?: string;
}) {
    const diff = simulated - actual;
    const improved = diff > 0;
    
    const formatValue = (val: number) => {
        if (format === 'percent') return val.toFixed(1) + '%';
        if (format === 'currency') {
            const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
            return symbol + val.toFixed(2);
        }
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

function ComparisonSummary({ result, currency }: { result: WhatIfResult; currency: string }) {
    const { actual, simulated, difference } = result;
    
    return (
        <div className="space-y-4 relative z-30">
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
                    currency={currency}
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
            
            {/* Improvement Summary */}
            <div className={cn(
                "p-3 rounded-lg text-sm",
                difference.improvement 
                    ? "bg-profit/10 border border-profit/20 text-profit" 
                    : "bg-loss/10 border border-loss/20 text-loss"
            )}>
                <div className="flex items-center gap-2">
                    {difference.improvement ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="font-bold">
                        {difference.improvement ? 'Potential Improvement' : 'Simulation Result'}
                    </span>
                </div>
                <p className="text-xs mt-1 opacity-80">
                    {difference.tradesRemoved} trades removed • 
                    P&L difference: {difference.pnlDifference >= 0 ? '+' : ''}{difference.pnlDifference.toFixed(2)}
                </p>
            </div>
        </div>
    );
}

// Advanced filter configuration popover
interface AdvancedFilterPopoverProps {
  type: 'duration' | 'marketSession' | 'dailyLoss' | 'weeklyLoss' | 'streakBreak' | 'bigLossCooldown' | 'positionSizing' | 'trailingStop' | 'volatility' | 'newsEvent';
  filters: WhatIfFilters;
  onChange: (filters: WhatIfFilters) => void;
  onClose: () => void;
}

function AdvancedFilterPopover({ type, filters, onChange, onClose }: AdvancedFilterPopoverProps) {
  const renderConfig = () => {
    switch (type) {
      case 'duration':
        return (
          <DurationFilterConfig
            value={{ minHours: filters.time?.minDurationHours, maxHours: filters.time?.maxDurationHours }}
            onChange={(v) => onChange({
              ...filters,
              time: { ...filters.time, minDurationHours: v.minHours, maxDurationHours: v.maxHours }
            })}
          />
        );
      case 'marketSession':
        return (
          <MarketSessionConfig
            value={filters.time?.marketSession ?? []}
            onChange={(v) => onChange({ ...filters, time: { ...filters.time, marketSession: v as ('LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP_LN' | 'OVERLAP_NA')[] } })}
          />
        );
      case 'dailyLoss':
        return (
          <LossLimitConfig
            value={filters.psychology?.dailyLossLimit}
            onChange={(v) => onChange({ ...filters, psychology: { ...filters.psychology, dailyLossLimit: v } })}
            label="Daily Loss Limit ($)"
          />
        );
      case 'weeklyLoss':
        return (
          <LossLimitConfig
            value={filters.psychology?.weeklyLossLimit}
            onChange={(v) => onChange({ ...filters, psychology: { ...filters.psychology, weeklyLossLimit: v } })}
            label="Weekly Loss Limit ($)"
          />
        );
      case 'streakBreak':
        return (
          <StreakBreakConfig
            value={filters.psychology?.stopAfterLosses}
            onChange={(v) => onChange({ ...filters, psychology: { ...filters.psychology, stopAfterLosses: v } })}
          />
        );
      case 'bigLossCooldown':
        return (
          <BigLossCooldownConfig
            value={filters.psychology?.avoidAfterBigLoss}
            onChange={(v) => onChange({ ...filters, psychology: { ...filters.psychology, avoidAfterBigLoss: v } })}
          />
        );
      case 'positionSizing':
        return (
          <PositionSizingConfig
            value={filters.risk?.riskPerTrade}
            onChange={(v) => onChange({ ...filters, risk: { ...filters.risk, riskPerTrade: v } })}
          />
        );
      case 'trailingStop':
        return (
          <TrailingStopConfig
            value={filters.risk?.trailingPercent}
            onChange={(v) => onChange({ ...filters, risk: { ...filters.risk, trailingPercent: v } })}
          />
        );
      case 'volatility':
        return (
          <VolatilityConfig
            value={filters.market ? { mode: 'avoid', threshold: filters.market.maxVolatility ?? 0.5 } : { mode: 'avoid', threshold: 0.5 }}
            onChange={(v) => onChange({ ...filters, market: { ...filters.market, maxVolatility: v.threshold } })}
          />
        );
      case 'newsEvent':
        return (
          <NewsEventConfig
            value={{ avoidHighImpact: filters.market?.avoidNewsEvents ?? true, windowMinutes: filters.market?.newsBufferMinutes ?? 30 }}
            onChange={(v) => onChange({ ...filters, market: { ...filters.market, avoidNewsEvents: v.avoidHighImpact, newsBufferMinutes: v.windowMinutes } })}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="absolute z-50 top-full left-0 mt-1 p-3 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Configure Filter</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
      {renderConfig()}
    </div>
  );
}

export function WhatIfSimulator() {
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<WhatIfFilters>({});
    const [activeFilters, setActiveFilters] = useState<WhatIfFilters | null>(null);
    const [advancedPopover, setAdvancedPopover] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    
    const { displayCurrency } = useSettings();
    const { data: result, isLoading, refetch } = useWhatIf(activeFilters);
    
    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (advancedPopover && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setAdvancedPopover(null);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [advancedPopover]);
    
    const handleRunSimulation = () => {
        setActiveFilters({ ...filters });
    };
    
    const handleClearFilters = () => {
        setFilters({});
        setActiveFilters(null);
    };
    
    // Count both basic and nested filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        
        // Basic flat filters
        if (filters.excludeDays?.length) count++;
        if (filters.excludeHours?.length) count++;
        if (filters.minRR !== undefined) count++;
        if (filters.maxRR !== undefined) count++;
        if (filters.minProfit !== undefined) count++;
        if (filters.maxProfit !== undefined) count++;
        if (filters.symbols?.length) count++;
        if (filters.direction) count++;
        
        // Time filters
        if (filters.time?.minDurationHours !== undefined) count++;
        if (filters.time?.maxDurationHours !== undefined) count++;
        if (filters.time?.marketSession?.length) count++;
        
        // Psychology filters
        if (filters.psychology?.dailyLossLimit !== undefined) count++;
        if (filters.psychology?.weeklyLossLimit !== undefined) count++;
        if (filters.psychology?.stopAfterLosses !== undefined) count++;
        if (filters.psychology?.avoidAfterBigLoss) count++;
        
        // Risk filters
        if (filters.risk?.riskPerTrade !== undefined) count++;
        if (filters.risk?.trailingPercent !== undefined) count++;
        if (filters.risk?.partialExitAt) count++;
        
        // Market filters
        if (filters.market?.minVolatility !== undefined) count++;
        if (filters.market?.maxVolatility !== undefined) count++;
        if (filters.market?.avoidNewsEvents !== undefined) count++;
        
        return count;
    }, [filters]);
    
    // Helper to get display value for each filter type
    const getFilterDisplayValue = (id: string): string | null => {
        switch (id) {
            case 'duration':
                const min = filters.time?.minDurationHours;
                const max = filters.time?.maxDurationHours;
                if (min !== undefined || max !== undefined) {
                    if (min !== undefined && max !== undefined) return `${min}-${max}h`;
                    if (min !== undefined) return `Min ${min}h`;
                    return `Max ${max}h`;
                }
                return null;
            case 'marketSession':
                const sessions = filters.time?.marketSession;
                if (sessions?.length) return sessions.map(s => s.replace('_', ' ')).join(', ');
                return null;
            case 'dailyLoss':
                if (filters.psychology?.dailyLossLimit !== undefined) return `$${filters.psychology.dailyLossLimit}`;
                return null;
            case 'weeklyLoss':
                if (filters.psychology?.weeklyLossLimit !== undefined) return `$${filters.psychology.weeklyLossLimit}`;
                return null;
            case 'streakBreak':
                if (filters.psychology?.stopAfterLosses !== undefined) return `${filters.psychology.stopAfterLosses} loss`;
                return null;
            case 'bigLossCooldown':
                const cd = filters.psychology?.avoidAfterBigLoss;
                if (cd) return `${cd.rThreshold}R, ${cd.cooldownHours}h`;
                return null;
            case 'positionSizing':
                if (filters.risk?.riskPerTrade !== undefined) return `${filters.risk.riskPerTrade}%`;
                return null;
            case 'trailingStop':
                if (filters.risk?.trailingPercent !== undefined) return `${(filters.risk.trailingPercent * 100).toFixed(0)}%`;
                return null;
            case 'volatility':
                if (filters.market?.maxVolatility !== undefined) return `≤${filters.market.maxVolatility}`;
                return null;
            case 'newsEvent':
                if (filters.market?.avoidNewsEvents) return `${filters.market.newsBufferMinutes ?? 30}m`;
                return null;
            default:
                return null;
        }
    };
    
    // Available advanced filter options
    const advancedFilterOptions = [
        { id: 'duration', label: 'Duration', category: 'time' as const },
        { id: 'marketSession', label: 'Market Session', category: 'time' as const },
        { id: 'dailyLoss', label: 'Daily Loss Limit', category: 'psychology' as const },
        { id: 'weeklyLoss', label: 'Weekly Loss Limit', category: 'psychology' as const },
        { id: 'streakBreak', label: 'Streak Break', category: 'psychology' as const },
        { id: 'bigLossCooldown', label: 'Big Loss Cooldown', category: 'psychology' as const },
        { id: 'positionSizing', label: 'Position Sizing', category: 'risk' as const },
        { id: 'trailingStop', label: 'Trailing Stop', category: 'risk' as const },
        { id: 'volatility', label: 'Volatility Filter', category: 'market' as const },
        { id: 'newsEvent', label: 'News Events', category: 'market' as const },
    ];
    
    const categoryColors = {
        time: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
        psychology: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
        risk: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
        market: 'bg-green-500/20 border-green-500/40 text-green-400',
    };
    
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
                        className="overflow-visible"
                    >
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05] mb-4 space-y-4 relative z-40">
                            {/* Basic Filters Section */}
                            <div className="pb-4 border-b border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                                    Basic Filters
                                </h4>
                                
                                {/* Day Filter */}
                                <div className="mb-3">
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
                                <div className="mb-3">
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
                                
                                {/* R:R & Profit Filters */}
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
                            </div>
                            
                            {/* Advanced Filters Section */}
                            <div ref={popoverRef}>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                                    Advanced Filters
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {advancedFilterOptions.map((option) => {
                                        const displayValue = getFilterDisplayValue(option.id);
                                        const hasValue = displayValue !== null;
                                        
                                        return (
                                        <div key={option.id} className="relative">
                                            <button
                                                onClick={() => setAdvancedPopover(advancedPopover === option.id ? null : option.id)}
                                                className={cn(
                                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all",
                                                    hasValue
                                                        ? "bg-primary/30 border-primary/60 text-white"
                                                        : categoryColors[option.category],
                                                    advancedPopover === option.id && "ring-2 ring-white/30"
                                                )}
                                            >
                                                <Settings2 size={10} />
                                                <span>{option.label}{hasValue && `: ${displayValue}`}</span>
                                            </button>
                                            
                                            <AnimatePresence>
                                                {advancedPopover === option.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -4 }}
                                                    >
                                                        <AdvancedFilterPopover
                                                            type={option.id as 'duration' | 'marketSession' | 'dailyLoss' | 'weeklyLoss' | 'streakBreak' | 'bigLossCooldown' | 'positionSizing' | 'trailingStop' | 'volatility' | 'newsEvent'}
                                                            filters={filters}
                                                            onChange={setFilters}
                                                            onClose={() => setAdvancedPopover(null)}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        );
                                    })}
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
                    {/* Day filters */}
                    {filters.excludeDays?.map(d => (
                        <FilterChip
                            key={`day-${d}`}
                            label={`No ${DAYS.find(day => day.value === d)?.label?.slice(0, 3)}`}
                            onRemove={() => setFilters({
                                ...filters,
                                excludeDays: filters.excludeDays?.filter(x => x !== d)
                            })}
                        />
                    ))}
                    {/* Hour filters */}
                    {filters.excludeHours?.map(h => (
                        <FilterChip
                            key={`hour-${h}`}
                            label={`No ${h.toString().padStart(2, '0')}:00`}
                            onRemove={() => setFilters({
                                ...filters,
                                excludeHours: filters.excludeHours?.filter(x => x !== h)
                            })}
                        />
                    ))}
                    {/* R:R filters */}
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
                    {/* Time filters */}
                    {filters.time?.minDurationHours !== undefined && (
                        <FilterChip
                            label={`Min ${filters.time.minDurationHours}h`}
                            onRemove={() => setFilters({ ...filters, time: { ...filters.time, minDurationHours: undefined } })}
                        />
                    )}
                    {filters.time?.maxDurationHours !== undefined && (
                        <FilterChip
                            label={`Max ${filters.time.maxDurationHours}h`}
                            onRemove={() => setFilters({ ...filters, time: { ...filters.time, maxDurationHours: undefined } })}
                        />
                    )}
                    {filters.time?.marketSession?.map(s => (
                        <FilterChip
                            key={`session-${s}`}
                            label={s.replace('_', ' ')}
                            onRemove={() => setFilters({
                                ...filters,
                                time: { ...filters.time, marketSession: filters.time?.marketSession?.filter(x => x !== s) }
                            })}
                        />
                    ))}
                    {/* Psychology filters */}
                    {filters.psychology?.dailyLossLimit !== undefined && (
                        <FilterChip
                            label={`Daily Limit: $${filters.psychology.dailyLossLimit}`}
                            onRemove={() => setFilters({ ...filters, psychology: { ...filters.psychology, dailyLossLimit: undefined } })}
                        />
                    )}
                    {filters.psychology?.weeklyLossLimit !== undefined && (
                        <FilterChip
                            label={`Weekly Limit: $${filters.psychology.weeklyLossLimit}`}
                            onRemove={() => setFilters({ ...filters, psychology: { ...filters.psychology, weeklyLossLimit: undefined } })}
                        />
                    )}
                    {filters.psychology?.stopAfterLosses !== undefined && (
                        <FilterChip
                            label={`Stop after ${filters.psychology.stopAfterLosses} losses`}
                            onRemove={() => setFilters({ ...filters, psychology: { ...filters.psychology, stopAfterLosses: undefined } })}
                        />
                    )}
                    {filters.psychology?.avoidAfterBigLoss && (
                        <FilterChip
                            label={`Cooldown after ${filters.psychology.avoidAfterBigLoss.rThreshold}R loss`}
                            onRemove={() => setFilters({ ...filters, psychology: { ...filters.psychology, avoidAfterBigLoss: undefined } })}
                        />
                    )}
                    {/* Risk filters */}
                    {filters.risk?.riskPerTrade !== undefined && (
                        <FilterChip
                            label={`Risk: ${filters.risk.riskPerTrade}%`}
                            onRemove={() => setFilters({ ...filters, risk: { ...filters.risk, riskPerTrade: undefined } })}
                        />
                    )}
                    {filters.risk?.trailingPercent !== undefined && (
                        <FilterChip
                            label={`Trail: ${(filters.risk.trailingPercent * 100).toFixed(0)}% retrace`}
                            onRemove={() => setFilters({ ...filters, risk: { ...filters.risk, trailingPercent: undefined } })}
                        />
                    )}
                    {filters.risk?.partialExitAt && (
                        <FilterChip
                            label={`Exit ${filters.risk.partialExitAt.percent}% at ${filters.risk.partialExitAt.rLevel}R`}
                            onRemove={() => setFilters({ ...filters, risk: { ...filters.risk, partialExitAt: undefined } })}
                        />
                    )}
                    {/* Market filters */}
                    {filters.market?.maxVolatility !== undefined && (
                        <FilterChip
                            label={`Volatility ≤ ${filters.market.maxVolatility}`}
                            onRemove={() => setFilters({ ...filters, market: { ...filters.market, maxVolatility: undefined } })}
                        />
                    )}
                    {filters.market?.avoidNewsEvents && (
                        <FilterChip
                            label={`No News (${filters.market.newsBufferMinutes ?? 30}m buffer)`}
                            onRemove={() => setFilters({ ...filters, market: { ...filters.market, avoidNewsEvents: undefined, newsBufferMinutes: undefined } })}
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
                <ComparisonSummary result={result} currency={displayCurrency} />
            )}
        </div>
    );
}