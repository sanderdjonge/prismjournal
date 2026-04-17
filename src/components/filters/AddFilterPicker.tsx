// src/components/filters/AddFilterPicker.tsx
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { FilterConfig, FilterOption, ActiveFilter } from '@/hooks/useFilters'

interface AddFilterPickerProps {
  config: FilterConfig[]
  activeFilters: ActiveFilter[]
  onAdd: (id: string, value: string | { from: string; to: string }) => void
  onSetMulti: (id: string, values: string[]) => void
  onClose: () => void
  dynamicOptions?: Record<string, FilterOption[]>
}

export function AddFilterPicker({
  config,
  activeFilters,
  onAdd,
  onSetMulti,
  onClose,
  dynamicOptions = {},
}: AddFilterPickerProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateError, setDateError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [textValue, setTextValue] = useState('')
  const [selectedMulti, setSelectedMulti] = useState<string[]>([])

  const selectedConfig = config.find(c => c.id === selectedId)
  const resolvedOptions = selectedId
    ? (selectedConfig?.options ?? dynamicOptions[selectedId] ?? [])
    : []

  const isAlreadyActive = (cfg: FilterConfig): boolean => {
    if (cfg.type === 'multi-select') return false // always available
    return activeFilters.some(f => f.id === cfg.id)
  }

  const handleSelectType = (id: string) => {
    setSelectedId(id)
    setStep(2)
    setDateFrom('')
    setDateTo('')
    setDateError('')
    setSearchQuery('')
    setTextValue('')
    // Pre-check all currently active multi-select values
    const current = activeFilters
      .filter(f => f.id === id && f.removeValue !== undefined)
      .map(f => f.removeValue as string)
    setSelectedMulti(current)
  }

  const handleApplyDate = () => {
    if (!dateFrom || !dateTo) {
      setDateError('Both dates are required')
      return
    }
    if (dateTo < dateFrom) {
      setDateError('End date must be after start date')
      return
    }
    onAdd(selectedId!, { from: dateFrom, to: dateTo })
    onClose()
  }

  const handleApplyMulti = () => {
    // Atomically replace all values for this filter ID (clears old, sets new)
    onSetMulti(selectedId!, selectedMulti)
    onClose()
  }

  const handleApplyText = () => {
    if (!textValue.trim()) return
    onAdd(selectedId!, textValue.trim())
    onClose()
  }

  const filteredOptions = resolvedOptions.filter(o =>
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      role="dialog"
      aria-label="Add filter"
      className="w-56 rounded-xl bg-[var(--surface-solid)] border border-border-color shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Back to filter list"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
          {step === 1 ? 'Add Filter' : selectedConfig?.label}
        </span>
      </div>

      {/* Step 1: Filter type list */}
      {step === 1 && (
        <div className="py-1">
          {config.map(cfg => {
            const disabled = isAlreadyActive(cfg)
            return (
              <button
                type="button"
                key={cfg.id}
                onClick={() => !disabled && handleSelectType(cfg.id)}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  disabled
                    ? 'text-gray-700 cursor-not-allowed'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Step 2: Value picker */}
      {step === 2 && selectedConfig && (
        <div className="p-3 space-y-2">
          {/* single-select: button group */}
          {selectedConfig.type === 'single-select' && (
            <div className="flex flex-wrap gap-1.5">
              {resolvedOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onAdd(selectedId!, opt.value); onClose() }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-gray-300 hover:bg-primary/20 hover:border-primary/40 hover:text-primary transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* multi-select: searchable checkbox list + Apply */}
          {selectedConfig.type === 'multi-select' && (
            <>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {filteredOptions.length === 0 && (
                  <p className="text-[10px] text-gray-600 py-2 text-center">No options</p>
                )}
                {filteredOptions.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMulti.includes(opt.value)}
                      onChange={e => {
                        setSelectedMulti(prev =>
                          e.target.checked ? [...prev, opt.value] : prev.filter(v => v !== opt.value)
                        )
                      }}
                      className="accent-primary"
                    />
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{opt.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleApplyMulti}
                className="w-full mt-1 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all"
              >
                Apply
              </button>
            </>
          )}

          {/* date-range: two date inputs + Apply */}
          {selectedConfig.type === 'date-range' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setDateError('') }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white outline-none focus:border-primary/50 [color-scheme:dark]"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setDateError('') }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white outline-none focus:border-primary/50 [color-scheme:dark]"
              />
              {dateError && (
                <p className="text-[9px] text-red-400 font-bold">{dateError}</p>
              )}
              <button
                type="button"
                onClick={handleApplyDate}
                disabled={!dateFrom || !dateTo}
                className="w-full py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </>
          )}

          {/* text: text input + Apply */}
          {selectedConfig.type === 'text' && (
            <>
              <input
                type="text"
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleApplyText() }}
                placeholder="Search..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
                autoFocus
              />
              <button
                type="button"
                onClick={handleApplyText}
                disabled={!textValue.trim()}
                className="w-full py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
