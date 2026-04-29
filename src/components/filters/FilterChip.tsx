// src/components/filters/FilterChip.tsx
'use client'

import { X } from 'lucide-react'
import { ActiveFilter } from '@/hooks/useFilters'

interface FilterChipProps {
  filter: ActiveFilter
  onRemove: (filter: ActiveFilter) => void
}

export function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary transition-all">
      {filter.label}
      <button
        type="button"
        onClick={() => onRemove(filter)}
        aria-label={`Remove ${filter.label} filter`}
        className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 hover:text-text-primary"
      >
        <X size={10} />
      </button>
    </span>
  )
}
