'use client'

import { useState, useCallback } from 'react'
import { X, Clock, Brain, Shield, TrendingUp, AlertTriangle, AlertCircle } from 'lucide-react'
import { WhatIfFilters } from '@/lib/services/what-if/types'

// Input validation utilities
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isValidNumber(value: string): boolean {
  return value !== '' && !isNaN(parseFloat(value))
}

// Validated number input props
interface ValidatedInputProps {
  value: string | number
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: string
  placeholder?: string
  className?: string
  allowUndefined?: boolean
}

function ValidatedNumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = '1',
  placeholder = '',
  className = '',
  allowUndefined = true,
}: ValidatedInputProps) {
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    
    if (raw === '') {
      setError(null)
      onChange(allowUndefined ? undefined : min)
      return
    }
    
    const parsed = parseFloat(raw)
    
    if (isNaN(parsed)) {
      setError('Invalid number')
      return
    }
    
    if (parsed < min) {
      setError(`Min: ${min}`)
      onChange(clamp(parsed, min, max))
      return
    }
    
    if (parsed > max) {
      setError(`Max: ${max}`)
      onChange(clamp(parsed, min, max))
      return
    }
    
    setError(null)
    onChange(parsed)
  }, [min, max, allowUndefined, onChange])
  
  const handleBlur = useCallback(() => {
    setTouched(true)
  }, [])
  
  const showError = touched && error
  
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        step={step}
        placeholder={placeholder}
        className={`${className} ${showError ? 'border-red-500/50 focus:border-red-500' : ''}`}
      />
      {showError && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 text-red-400">
          <AlertCircle size={10} />
        </div>
      )}
      {showError && (
        <p className="text-[8px] text-red-400 mt-0.5">{error}</p>
      )}
    </div>
  )
}

export interface WhatIfActiveFilter {
  id: string
  label: string
  category: 'time' | 'psychology' | 'risk' | 'market'
  value: unknown
}

interface WhatIfFilterChipProps {
  filter: WhatIfActiveFilter
  onRemove: (id: string) => void
  onConfigure?: (id: string) => void
}

const categoryIcons = {
  time: Clock,
  psychology: Brain,
  risk: Shield,
  market: TrendingUp,
}

const categoryColors = {
  time: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  psychology: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  risk: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  market: 'bg-green-500/20 border-green-500/40 text-green-400',
}

export function WhatIfFilterChip({ filter, onRemove, onConfigure }: WhatIfFilterChipProps) {
  const Icon = categoryIcons[filter.category]
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer hover:opacity-80 ${categoryColors[filter.category]}`}
      onClick={() => onConfigure?.(filter.id)}
    >
      <Icon size={10} />
      {filter.label}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(filter.id) }}
        aria-label={`Remove ${filter.label} filter`}
        className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 hover:text-white"
      >
        <X size={10} />
      </button>
    </span>
  )
}

// Filter configuration components

interface DurationFilterConfigProps {
  value?: { minHours?: number; maxHours?: number }
  onChange: (value: { minHours?: number; maxHours?: number }) => void
}

export function DurationFilterConfig({ value, onChange }: DurationFilterConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Duration Filter (hours)
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          value={value?.minHours ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...value, minHours: v === '' ? undefined : parseFloat(v) || undefined });
          }}
          min={0}
          max={168}
          step="0.5"
          placeholder="Min"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
        />
        <input
          type="number"
          value={value?.maxHours ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...value, maxHours: v === '' ? undefined : parseFloat(v) || undefined });
          }}
          min={0}
          max={168}
          step="0.5"
          placeholder="Max"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
        />
      </div>
      <p className="text-[8px] text-gray-500">Exclude trades shorter than Min or longer than Max hours.</p>
    </div>
  )
}

interface MarketSessionConfigProps {
  value: string[]
  onChange: (value: string[]) => void
}

export function MarketSessionConfig({ value, onChange }: MarketSessionConfigProps) {
  const sessions = [
    { id: 'LONDON', label: 'London', time: '08:00-17:00 UTC' },
    { id: 'NEW_YORK', label: 'New York', time: '13:00-22:00 UTC' },
    { id: 'ASIA', label: 'Asia', time: '00:00-09:00 UTC' },
    { id: 'OVERLAP_LN', label: 'London-NY Overlap', time: '13:00-17:00 UTC' },
  ]
  
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Market Sessions
      </label>
      {sessions.map((session) => (
        <label key={session.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(session.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...value, session.id])
              } else {
                onChange(value.filter((v) => v !== session.id))
              }
            }}
            className="accent-primary"
          />
          <div>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{session.label}</span>
            <span className="text-[8px] text-gray-500 ml-1">{session.time}</span>
          </div>
        </label>
      ))}
    </div>
  )
}

interface LossLimitConfigProps {
  value?: number
  onChange: (value: number) => void
  label: string
}

export function LossLimitConfig({ value, onChange, label }: LossLimitConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400">$</span>
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onChange(undefined as unknown as number);
            } else {
              const parsed = parseFloat(v);
              if (!isNaN(parsed)) onChange(parsed);
            }
          }}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
          placeholder="Enter limit..."
        />
      </div>
      <p className="text-[8px] text-gray-500">Stop trading for the day/week after losing this amount.</p>
    </div>
  )
}

interface StreakBreakConfigProps {
  value?: number
  onChange: (value: number) => void
}

export function StreakBreakConfig({ value, onChange }: StreakBreakConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Stop After Consecutive Losses
      </label>
      <input
        type="number"
        min={1}
        max={10}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange(undefined as unknown as number);
          } else {
            const parsed = parseInt(v, 10);
            if (!isNaN(parsed)) onChange(parsed);
          }
        }}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
        placeholder="Number of losses..."
      />
      <p className="text-[8px] text-gray-500">Hard stop trading after X consecutive losing trades.</p>
    </div>
  )
}

interface BigLossCooldownConfigProps {
  value?: { rThreshold: number; cooldownHours: number }
  onChange: (value: { rThreshold: number; cooldownHours: number }) => void
}

export function BigLossCooldownConfig({ value, onChange }: BigLossCooldownConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Big Loss Cooldown
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            step="0.5"
            placeholder="R threshold"
            value={value?.rThreshold ?? ''}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...value, rThreshold: v, cooldownHours: value?.cooldownHours ?? 2 }); }}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
          />
          <span className="text-[8px] text-gray-500">R threshold</span>
        </div>
        <div className="flex-1">
          <input
            type="number"
            placeholder="Cooldown"
            value={value?.cooldownHours ?? ''}
            onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange({ ...value, rThreshold: value?.rThreshold ?? 2, cooldownHours: v }); }}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
          />
          <span className="text-[8px] text-gray-500">Hours cooldown</span>
        </div>
      </div>
    </div>
  )
}

interface PositionSizingConfigProps {
  value?: number
  onChange: (value: number) => void
}

export function PositionSizingConfig({ value, onChange }: PositionSizingConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Risk Per Trade (%)
      </label>
      <input
        type="number"
        step="0.1"
        min="0.1"
        max="10"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange(undefined as unknown as number);
          } else {
            const parsed = parseFloat(v);
            if (!isNaN(parsed)) onChange(parsed);
          }
        }}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
        placeholder="1.0"
      />
      <p className="text-[8px] text-gray-500">Scale P&L by adjusting risk %. Higher % = larger gains/losses.</p>
    </div>
  )
}

interface TrailingStopConfigProps {
  value?: number
  onChange: (value: number) => void
}

export function TrailingStopConfig({ value, onChange }: TrailingStopConfigProps) {
  // trailPercent is stored as decimal (0.5 = 50%)
  // Display as percentage for clarity
  const displayValue = value !== undefined ? (value * 100).toFixed(0) : '';
  
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Trailing Stop (% of peak profit)
      </label>
      <input
        type="number"
        step="10"
        min="10"
        max="90"
        value={displayValue}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) {
            onChange(v / 100);
          }
        }}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
        placeholder="50"
      />
      <p className="text-[8px] text-gray-500">Exit when price retraces X% from peak. E.g., 50% on a 2R peak trade exits at 1R.</p>
    </div>
  )
}

interface VolatilityConfigProps {
  value?: { mode: 'avoid' | 'prefer'; threshold: number }
  onChange: (value: { mode: 'avoid' | 'prefer'; threshold: number }) => void
}

export function VolatilityConfig({ value, onChange }: VolatilityConfigProps) {
  const currentValue = value ?? { mode: 'avoid' as const, threshold: 0.5 }
  
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        Volatility Filter
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...currentValue, mode: 'avoid' })}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            currentValue.mode === 'avoid'
              ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400'
              : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
          }`}
        >
          Avoid High
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...currentValue, mode: 'prefer' })}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            currentValue.mode === 'prefer'
              ? 'bg-green-500/20 border border-green-500/40 text-green-400'
              : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
          }`}
        >
          Prefer High
        </button>
      </div>
      <input
        type="number"
        step="0.1"
        placeholder="ATR % threshold"
        value={currentValue.threshold ?? ''}
        onChange={(e) => onChange({ ...currentValue, threshold: parseFloat(e.target.value) || 0.5 })}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
      />
    </div>
  )
}

interface NewsEventConfigProps {
  value?: { avoidHighImpact: boolean; windowMinutes: number }
  onChange: (value: { avoidHighImpact: boolean; windowMinutes: number }) => void
}

export function NewsEventConfig({ value, onChange }: NewsEventConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">
        News Event Filter
      </label>
      <label className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-white/5 cursor-pointer">
        <input
          type="checkbox"
          checked={value?.avoidHighImpact ?? true}
          onChange={(e) => onChange({ avoidHighImpact: e.target.checked, windowMinutes: value?.windowMinutes ?? 30 })}
          className="accent-primary"
        />
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Avoid High Impact News</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={5}
          max={120}
          value={value?.windowMinutes ?? 30}
          onChange={(e) => onChange({ avoidHighImpact: value?.avoidHighImpact ?? true, windowMinutes: parseInt(e.target.value) })}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white outline-none focus:border-primary/50"
        />
        <span className="text-[10px] text-gray-400 whitespace-nowrap">min buffer</span>
      </div>
    </div>
  )
}