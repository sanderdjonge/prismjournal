'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useMemo, useCallback } from 'react'

export type FilterType = 'single-select' | 'multi-select' | 'date-range' | 'text'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  id: string           // e.g. 'side', 'tag', 'dateRange'
  label: string
  type: FilterType
  paramKeys?: string[] // only for date-range: ['dateFrom', 'dateTo']
  options?: FilterOption[] // static options; omit for dynamic (tag, account)
}

// One entry per discrete value.
// Multi-select with 2 tags → 2 ActiveFilter entries.
// Date-range → 1 entry (both params removed together via paramKeys).
export interface ActiveFilter {
  id: string           // config id, e.g. 'tag', 'dateRange'
  label: string        // display label: "Tag: Breakout", "Date: 2026-01-01 → 2026-03-27"
  removeValue?: string // for multi-select: the specific URL value this chip removes
  paramKeys: string[]  // URL keys to clear when removing this chip
}

function getParamKeys(cfg: FilterConfig): string[] {
  if (cfg.type === 'date-range') {
    return cfg.paramKeys ?? ['dateFrom', 'dateTo']
  }
  return cfg.paramKeys ?? [cfg.id]
}

/**
 * @param config Filter configuration array.
 * Must be a stable reference across renders (defined at module level or wrapped in useMemo).
 * An inline array literal will defeat memoization.
 */
export function useFilters(config: FilterConfig[]) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = []

    for (const cfg of config) {
      if (cfg.type === 'date-range') {
        const keys = getParamKeys(cfg)
        const from = searchParams.get(keys[0])
        const to = searchParams.get(keys[1])
        if (from || to) {
          filters.push({
            id: cfg.id,
            label: `${cfg.label}: ${from ?? '?'} → ${to ?? '?'}`,
            paramKeys: keys,
          })
        }
      } else if (cfg.type === 'multi-select') {
        const values = searchParams.getAll(cfg.id)
        for (const val of values) {
          const opt = cfg.options?.find(o => o.value === val)
          filters.push({
            id: cfg.id,
            label: `${cfg.label}: ${opt?.label ?? val}`,
            removeValue: val,
            paramKeys: [cfg.id],
          })
        }
      } else {
        const val = searchParams.get(cfg.id)
        if (val) {
          const opt = cfg.options?.find(o => o.value === val)
          filters.push({
            id: cfg.id,
            label: `${cfg.label}: ${opt?.label ?? val}`,
            removeValue: val,
            paramKeys: [cfg.id],
          })
        }
      }
    }

    return filters
  }, [searchParams, config])

  const buildUrl = useCallback((params: URLSearchParams): string => {
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [pathname])

  const addFilter = useCallback(
    (id: string, value: string | { from: string; to: string }) => {
      const cfg = config.find(c => c.id === id)
      if (!cfg) return
      const params = new URLSearchParams(searchParams.toString())

      if (cfg.type === 'date-range') {
        const v = value as { from: string; to: string }
        const keys = cfg.paramKeys ?? ['dateFrom', 'dateTo']
        params.set(keys[0], v.from)
        params.set(keys[1], v.to)
      } else if (cfg.type === 'multi-select') {
        const existing = params.getAll(id)
        if (!existing.includes(value as string)) {
          params.append(id, value as string)
        }
      } else {
        params.set(id, value as string)
      }

      router.replace(buildUrl(params), { scroll: false })
    },
    [config, searchParams, router, buildUrl]
  )

  const removeFilter = useCallback(
    (filter: ActiveFilter) => {
      const cfg = config.find(c => c.id === filter.id)
      if (!cfg) return
      const params = new URLSearchParams(searchParams.toString())

      if (cfg.type === 'multi-select' && filter.removeValue) {
        const remaining = params.getAll(filter.id).filter(v => v !== filter.removeValue)
        params.delete(filter.id)
        for (const v of remaining) params.append(filter.id, v)
      } else {
        for (const key of filter.paramKeys) params.delete(key)
      }

      router.replace(buildUrl(params), { scroll: false })
    },
    [config, searchParams, router, buildUrl]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    for (const cfg of config) {
      const keys = getParamKeys(cfg)
      for (const key of keys) params.delete(key)
    }
    router.replace(buildUrl(params), { scroll: false })
  }, [config, searchParams, router, buildUrl])

  const getParam = useCallback(
    (key: string): string | null => searchParams.get(key),
    [searchParams]
  )

  const setMultiFilter = useCallback(
    (id: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(id)
      for (const v of values) params.append(id, v)
      router.replace(buildUrl(params), { scroll: false })
    },
    [searchParams, router, buildUrl]
  )

  return { activeFilters, addFilter, removeFilter, setMultiFilter, clearAll, getParam }
}
