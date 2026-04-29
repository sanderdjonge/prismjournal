'use client'

import { useState } from 'react'
import { Link2, Search, X, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api/client'
import { useCurrency } from '@/lib/currency'

interface RelatedTrade {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  pnl: number | null
  entryTime: string | null
}

interface RelatedTradesProps {
  tradeId: string
  relatedTradeIds: string[]
  onNavigate: (tradeId: string) => void
  onLinkedChange?: () => void
}

function RelatedTradeCard({ trade, onNavigate }: { trade: RelatedTrade; onNavigate: (id: string) => void }) {
  const { formatPnl } = useCurrency()

  return (
    <button
      onClick={() => onNavigate(trade.id)}
      className="w-full flex items-center gap-2 p-2 bg-surface-elevated border border-border-subtle rounded-lg hover:border-primary/30 transition-colors text-left"
    >
      <span className={`p-1 rounded ${trade.direction === 'LONG' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
        {trade.direction === 'LONG' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-white truncate">{trade.symbol}</div>
        <div className="text-[8px] text-text-muted">
          {trade.entryPrice.toFixed(trade.entryPrice < 10 ? 5 : 2)}
          {trade.entryTime && ` · ${new Date(trade.entryTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
        </div>
      </div>
      {trade.pnl !== null && (
        <span className={`text-[10px] font-bold font-mono ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatPnl(trade.pnl)}
        </span>
      )}
    </button>
  )
}

export function RelatedTrades({ tradeId, relatedTradeIds, onNavigate, onLinkedChange }: RelatedTradesProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RelatedTrade[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [linkedTrades, setLinkedTrades] = useState<RelatedTrade[]>([])
  const [loadedIds, setLoadedIds] = useState<string>('')

  const needsLoad = relatedTradeIds.length > 0 && loadedIds !== relatedTradeIds.join(',')

  if (needsLoad && !isSearching) {
    const loadTrades = async () => {
      setIsSearching(true)
      try {
        const results = await Promise.all(
          relatedTradeIds.map(async (id) => {
            const data = await apiFetch<RelatedTrade>(`/api/trades/${id}`)
            return data
          })
        )
        setLinkedTrades(results.filter(Boolean))
        setLoadedIds(relatedTradeIds.join(','))
      } catch {
        setLinkedTrades([])
      } finally {
        setIsSearching(false)
      }
    }
    loadTrades()
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const data = await apiFetch<{ trades: RelatedTrade[] }>(`/api/trades?search=${encodeURIComponent(searchQuery)}&limit=10`)
      setSearchResults((data.trades ?? []).filter(t => t.id !== tradeId && !relatedTradeIds.includes(t.id)))
    } catch {
      toast.error('Search failed')
    }
  }

  const handleLink = async (relatedId: string) => {
    try {
      await fetch(`/api/trades/${tradeId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedTradeId: relatedId }),
      })
      toast.success('Trade linked')
      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
      onLinkedChange?.()
    } catch {
      toast.error('Failed to link trade')
    }
  }

  const handleUnlink = async (relatedId: string) => {
    try {
      await fetch(`/api/trades/${tradeId}/link`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedTradeId: relatedId }),
      })
      toast.success('Trade unlinked')
      setLinkedTrades(prev => prev.filter(t => t.id !== relatedId))
      onLinkedChange?.()
    } catch {
      toast.error('Failed to unlink trade')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted flex items-center gap-1.5">
          <Link2 size={11} /> Related Trades
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-[0.08em] text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
        >
          <Search size={9} /> Link
        </button>
      </div>

      {linkedTrades.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {linkedTrades.map(t => (
            <div key={t.id} className="relative group">
              <RelatedTradeCard trade={t} onNavigate={onNavigate} />
              <button
                onClick={(e) => { e.stopPropagation(); handleUnlink(t.id) }}
                className="absolute top-1 right-1 p-0.5 rounded bg-surface-hover text-text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {relatedTradeIds.length === 0 && !showSearch && (
        <div className="text-[10px] text-text-muted italic">No linked trades</div>
      )}

      {showSearch && (
        <div className="space-y-2">
          <div className="flex gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search by symbol..."
              className="flex-1 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-lg text-[10px] text-white placeholder-gray-600 focus:border-primary/40 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSearch}
              className="px-2 py-1 bg-primary/20 border border-primary/30 rounded-lg text-primary text-[9px] font-bold hover:bg-primary/30 transition-all"
            >
              Find
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {searchResults.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleLink(t.id)}
                  className="w-full flex items-center gap-2 p-1.5 bg-surface-elevated border border-border-subtle rounded-lg hover:border-primary/30 transition-colors text-left"
                >
                  <span className={`text-[9px] font-bold uppercase ${t.direction === 'LONG' ? 'text-profit' : 'text-loss'}`}>
                    {t.direction}
                  </span>
                  <span className="text-[10px] text-white font-semibold">{t.symbol}</span>
                  {t.pnl !== null && (
                    <span className={`text-[9px] font-mono ml-auto ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
