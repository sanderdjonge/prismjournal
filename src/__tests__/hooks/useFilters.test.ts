import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters, FilterConfig } from '@/hooks/useFilters'

// Override the global mock from setup.ts per-test
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/trades',
}))

const SIDE_CONFIG: FilterConfig[] = [
  { id: 'side', label: 'Side', type: 'single-select', options: [
    { value: 'LONG', label: 'Long' },
    { value: 'SHORT', label: 'Short' },
  ]},
]

const TAG_CONFIG: FilterConfig[] = [
  { id: 'tag', label: 'Tag', type: 'multi-select' },
]

const DATE_CONFIG: FilterConfig[] = [
  { id: 'dateRange', label: 'Date Range', type: 'date-range', paramKeys: ['dateFrom', 'dateTo'] },
]

beforeEach(() => {
  mockReplace.mockClear()
  mockSearchParams = new URLSearchParams()
})

describe('useFilters — single-select', () => {
  it('returns empty activeFilters when URL has no params', () => {
    const { result } = renderHook(() => useFilters(SIDE_CONFIG))
    expect(result.current.activeFilters).toEqual([])
  })

  it('reads existing URL param as an active filter on mount', () => {
    mockSearchParams = new URLSearchParams('side=LONG')
    const { result } = renderHook(() => useFilters(SIDE_CONFIG))
    expect(result.current.activeFilters).toHaveLength(1)
    expect(result.current.activeFilters[0].id).toBe('side')
    expect(result.current.activeFilters[0].label).toBe('Side: Long')
  })

  it('addFilter writes the correct URL param', () => {
    const { result } = renderHook(() => useFilters(SIDE_CONFIG))
    act(() => { result.current.addFilter('side', 'LONG') })
    expect(mockReplace).toHaveBeenCalledOnce()
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('side=LONG')
  })

  it('addFilter replaces an existing single-select value', () => {
    mockSearchParams = new URLSearchParams('side=LONG')
    const { result } = renderHook(() => useFilters(SIDE_CONFIG))
    act(() => { result.current.addFilter('side', 'SHORT') })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('side=SHORT')
    expect(calledUrl).not.toContain('side=LONG')
  })

  it('removeFilter clears the param', () => {
    mockSearchParams = new URLSearchParams('side=LONG')
    const { result } = renderHook(() => useFilters(SIDE_CONFIG))
    act(() => {
      result.current.removeFilter(result.current.activeFilters[0])
    })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('side=')
  })
})

describe('useFilters — multi-select', () => {
  it('two tag params produce two ActiveFilter entries', () => {
    mockSearchParams = new URLSearchParams('tag=foo&tag=bar')
    const { result } = renderHook(() => useFilters(TAG_CONFIG))
    expect(result.current.activeFilters).toHaveLength(2)
  })

  it('removeFilter on one tag chip leaves the other', () => {
    mockSearchParams = new URLSearchParams('tag=foo&tag=bar')
    const { result } = renderHook(() => useFilters(TAG_CONFIG))
    const fooChip = result.current.activeFilters.find(f => f.removeValue === 'foo')!
    act(() => { result.current.removeFilter(fooChip) })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('tag=bar')
    expect(calledUrl).not.toContain('tag=foo')
  })
})

describe('useFilters — date-range', () => {
  it('addFilter writes both dateFrom and dateTo', () => {
    const { result } = renderHook(() => useFilters(DATE_CONFIG))
    act(() => { result.current.addFilter('dateRange', { from: '2026-01-01', to: '2026-03-27' }) })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('dateFrom=2026-01-01')
    expect(calledUrl).toContain('dateTo=2026-03-27')
  })

  it('removeFilter removes both dateFrom and dateTo atomically', () => {
    mockSearchParams = new URLSearchParams('dateFrom=2026-01-01&dateTo=2026-03-27')
    const { result } = renderHook(() => useFilters(DATE_CONFIG))
    act(() => { result.current.removeFilter(result.current.activeFilters[0]) })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('dateFrom')
    expect(calledUrl).not.toContain('dateTo')
  })
})

describe('useFilters — clearAll', () => {
  it('removes all filter params from URL', () => {
    mockSearchParams = new URLSearchParams('side=LONG&tag=foo&dateFrom=2026-01-01&dateTo=2026-03-27')
    const config: FilterConfig[] = [...SIDE_CONFIG, ...TAG_CONFIG, ...DATE_CONFIG]
    const { result } = renderHook(() => useFilters(config))
    act(() => { result.current.clearAll() })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('side=')
    expect(calledUrl).not.toContain('tag=')
    expect(calledUrl).not.toContain('dateFrom=')
    expect(calledUrl).not.toContain('dateTo=')
  })

  it('clears dateFrom and dateTo when paramKeys is absent from date-range config', () => {
    mockSearchParams = new URLSearchParams('dateFrom=2026-01-01&dateTo=2026-03-27')
    const implicitDateConfig: FilterConfig[] = [
      { id: 'dateRange', label: 'Date Range', type: 'date-range' }  // no paramKeys
    ]
    const { result } = renderHook(() => useFilters(implicitDateConfig))
    act(() => { result.current.clearAll() })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('dateFrom')
    expect(calledUrl).not.toContain('dateTo')
  })
})

describe('useFilters — setMultiFilter', () => {
  it('replaces all existing values atomically', () => {
    mockSearchParams = new URLSearchParams('tag=foo&tag=bar')
    const { result } = renderHook(() => useFilters(TAG_CONFIG))
    act(() => { result.current.setMultiFilter('tag', ['baz']) })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('tag=baz')
    expect(calledUrl).not.toContain('tag=foo')
    expect(calledUrl).not.toContain('tag=bar')
  })

  it('clears all values when called with empty array', () => {
    mockSearchParams = new URLSearchParams('tag=foo&tag=bar')
    const { result } = renderHook(() => useFilters(TAG_CONFIG))
    act(() => { result.current.setMultiFilter('tag', []) })
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('tag=')
  })
})

describe('useFilters — getParam', () => {
  it('returns a single URL param value', () => {
    mockSearchParams = new URLSearchParams('dateFrom=2026-01-01')
    const { result } = renderHook(() => useFilters(DATE_CONFIG))
    expect(result.current.getParam('dateFrom')).toBe('2026-01-01')
  })

  it('returns null when param is absent', () => {
    const { result } = renderHook(() => useFilters(DATE_CONFIG))
    expect(result.current.getParam('dateFrom')).toBeNull()
  })
})
