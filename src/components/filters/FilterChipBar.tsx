// src/components/filters/FilterChipBar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { FilterConfig, FilterOption, ActiveFilter } from '@/hooks/useFilters'
import { FilterChip } from './FilterChip'
import { AddFilterPicker } from './AddFilterPicker'

interface FilterChipBarProps {
  config: FilterConfig[]
  activeFilters: ActiveFilter[]
  onAdd: (id: string, value: string | { from: string; to: string }) => void
  onSetMulti: (id: string, values: string[]) => void
  onRemove: (filter: ActiveFilter) => void
  onClear: () => void
  dynamicOptions?: Record<string, FilterOption[]>
}

export function FilterChipBar({
  config,
  activeFilters,
  onAdd,
  onSetMulti,
  onRemove,
  onClear,
  dynamicOptions = {},
}: FilterChipBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active chips */}
      {activeFilters.map((filter, i) => (
        <FilterChip key={`${filter.id}-${filter.removeValue ?? i}`} filter={filter} onRemove={onRemove} />
      ))}

      {/* Add filter button + popover */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-dashed border-white/20 text-gray-500 hover:border-white/40 hover:text-gray-300 transition-all"
        >
          <Plus size={10} />
          Add filter
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1.5 z-50">
            <AddFilterPicker
              config={config}
              activeFilters={activeFilters}
              onAdd={(id, value) => { onAdd(id, value); setIsOpen(false) }}
              onSetMulti={(id, values) => { onSetMulti(id, values); setIsOpen(false) }}
              onClose={() => setIsOpen(false)}
              dynamicOptions={dynamicOptions}
            />
          </div>
        )}
      </div>

      {/* Clear all */}
      {activeFilters.length >= 1 && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-300 underline transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
