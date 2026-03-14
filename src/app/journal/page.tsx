'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import DashboardShell from '@/components/layout/DashboardShell';
import DraggableTable from '@/components/journal/DraggableTable';
import TradeAnalysisDrawer from '@/components/journal/TradeAnalysisDrawer';
import TradeEntryModal from '@/components/journal/TradeEntryModal';
import { Search, Plus, Zap, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export type JournalTrade = {
    id: string;
    ticket: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    entry: number;
    exit: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    commission?: number;
    swap?: number;
    pnl: number;
    time: string;
    mood?: string | null;
    planCompliance?: string | null;
    notes?: string | null;
    strategy?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
};

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

function JournalContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Initialize state from URL params
    const [trades, setTrades] = useState<JournalTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [filterSide, setFilterSide] = useState<string>(searchParams.get('side') || 'ALL');
    const [filterResult, setFilterResult] = useState<string>(searchParams.get('result') || 'ALL');
    const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
    const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
    const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pagination, setPagination] = useState<Pagination>({
        page: parseInt(searchParams.get('page') || '1'),
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    // Update URL params when filters change
    const updateUrlParams = useCallback((params: Record<string, string | null>) => {
        const newSearchParams = new URLSearchParams(searchParams.toString());

        Object.entries(params).forEach(([key, value]) => {
            if (value && value !== 'ALL' && value !== '') {
                newSearchParams.set(key, value);
            } else {
                newSearchParams.delete(key);
            }
        });

        const newUrl = newSearchParams.toString()
            ? `${window.location.pathname}?${newSearchParams.toString()}`
            : window.location.pathname;

        router.replace(newUrl, { scroll: false });
    }, [searchParams, router]);

    // Fetch trades with server-side filtering
    const fetchTrades = useCallback(async (page: number = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            if (searchQuery) params.set('q', searchQuery);
            if (filterSide !== 'ALL') params.set('side', filterSide);
            if (filterResult !== 'ALL') params.set('result', filterResult);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            params.set('page', page.toString());

            const res = await fetch(`/api/trades?${params.toString()}`);
            const data = await res.json();

            setTrades(data.trades);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Failed to fetch trades', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filterSide, filterResult, dateFrom, dateTo]);

    // Debounced search to prevent excessive API calls
    const debouncedSearch = useDebouncedCallback((value: string) => {
        setSearchQuery(value);
        updateUrlParams({ q: value || null });
    }, 300);

    // Effect to fetch trades when filters change
    useEffect(() => {
        fetchTrades(1); // Reset to page 1 when filters change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filterSide, filterResult, dateFrom, dateTo]);

    // Update URL when filters change
    useEffect(() => {
        updateUrlParams({
            side: filterSide,
            result: filterResult,
            from: dateFrom || null,
            to: dateTo || null,
        });
    }, [filterSide, filterResult, dateFrom, dateTo, updateUrlParams]);

    const handlePageChange = (newPage: number) => {
        fetchTrades(newPage);
        updateUrlParams({ page: newPage.toString() });
    };

    const handleAnalyze = (trade: JournalTrade) => {
        setSelectedTrade(trade);
        setIsDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
        setSelectedTrade(null);
    };

    const handleTradeSaved = (updated: JournalTrade) => {
        setTrades(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    };

    const handleTradeDeleted = (id: string) => {
        setTrades(prev => prev.filter(t => t.id !== id));
        setIsDrawerOpen(false);
        setSelectedTrade(null);
    };

    const handleTradeAdded = (trade: JournalTrade) => {
        setTrades(prev => [trade, ...prev]);
        setIsModalOpen(false);
        // Refresh to get accurate pagination
        fetchTrades(1);
    };

    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">The Vault</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">
                            Trade Journal // {pagination.total} records
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-10 px-6 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:brightness-110 shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all active:scale-95 shrink-0"
                    >
                        <Plus size={14} /> New Record
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="glass-card flex items-center gap-3 px-4 py-2 border-white/5 bg-white/5 focus-within:border-primary/50 transition-all">
                        <Search size={14} className="text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search symbol, ticket..."
                            className="bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-600 w-40 font-bold"
                            defaultValue={searchQuery}
                            onChange={(e) => debouncedSearch(e.target.value)}
                        />
                    </div>

                    <div className="glass-card flex items-center gap-1 border-white/5 bg-white/5 p-1">
                        {['ALL', 'BUY', 'SELL'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterSide(type)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterSide === type
                                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                    : 'text-gray-600 hover:text-gray-400'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <div className="glass-card flex items-center gap-1 border-white/5 bg-white/5 p-1">
                        {['ALL', 'WIN', 'LOSS', 'OPEN'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterResult(type)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterResult === type
                                    ? type === 'WIN' ? 'bg-accent/20 text-accent' :
                                      type === 'LOSS' ? 'bg-danger/20 text-danger' :
                                      type === 'OPEN' ? 'bg-secondary/20 text-secondary' :
                                      'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                    : 'text-gray-600 hover:text-gray-400'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <div className="glass-card flex items-center gap-2 border-white/5 bg-white/5 px-3 py-1.5">
                        <Calendar size={12} className="text-gray-500" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-transparent border-none outline-none text-[10px] text-white font-bold w-28 [color-scheme:dark]"
                            placeholder="From"
                        />
                        <span className="text-gray-600 text-[10px]">—</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-transparent border-none outline-none text-[10px] text-white font-bold w-28 [color-scheme:dark]"
                            placeholder="To"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="text-gray-500 hover:text-white text-[10px] font-black ml-1"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Table Container */}
                <div className="glass-card border-white/5 bg-black/40 backdrop-blur-md overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-48 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                            Loading Vault...
                        </div>
                    ) : trades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-600">
                            <p className="text-[10px] font-black uppercase tracking-widest">No records found</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                            >
                                + Log your first trade
                            </button>
                        </div>
                    ) : (
                        <DraggableTable data={trades} onAnalyze={handleAnalyze} />
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="p-2 rounded-lg glass-card border-white/5 bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span className="text-white">{pagination.page}</span>
                            <span>of</span>
                            <span className="text-white">{pagination.totalPages}</span>
                        </div>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-2 rounded-lg glass-card border-white/5 bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Status HUD */}
                <div className="flex gap-8 px-6 py-4 glass-card border-white/5 bg-white/5 border-dashed">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
                            <Zap size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Archive Sync</p>
                            <p className="text-xs font-bold text-white uppercase">Operational</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 border-l border-white/5 pl-8">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Active Range</p>
                            <p className="text-xs font-bold text-white uppercase">
                                {pagination.total > 0
                                    ? `${pagination.total} records`
                                    : 'No records yet'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TradeEntryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSaved={handleTradeAdded}
            />

            <TradeAnalysisDrawer
                trade={selectedTrade}
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                onSaved={handleTradeSaved}
                onDeleted={handleTradeDeleted}
            />
        </DashboardShell>
    );
}

export default function JournalPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center h-96 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                    Loading Vault...
                </div>
            </DashboardShell>
        }>
            <JournalContent />
        </Suspense>
    );
}
