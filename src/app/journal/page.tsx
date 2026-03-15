'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import DashboardShell from '@/components/layout/DashboardShell';
import DraggableTable from '@/components/journal/DraggableTable';
import TradeViewModal from '@/components/journal/TradeViewModal';
import TradeEditModal from '@/components/journal/TradeEditModal';
import TradeEntryModal from '@/components/journal/TradeEntryModal';
import { SkeletonRow } from '@/components/ui';
import { useTrades, useDeleteTrade, TradeFilters } from '@/hooks/useTrades';
import { useTags } from '@/hooks/useTags';
import { Search, Plus, Zap, Calendar, ChevronLeft, ChevronRight, Download, Tag as TagIcon } from 'lucide-react';

export type JournalTrade = {
    id: string;
    ticket: string;
    symbol: string;
    type: 'LONG' | 'SHORT';
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

function JournalContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Filter state (kept as-is to feed into query key)
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [filterSide, setFilterSide] = useState<string>(searchParams.get('side') || 'ALL');
    const [filterResult, setFilterResult] = useState<string>(searchParams.get('result') || 'ALL');
    const [filterTag, setFilterTag] = useState<string>(searchParams.get('tag') || 'ALL');
    const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
    const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
    const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

    // Modal state
    const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Build filters object for React Query
    const filters: TradeFilters = {
        q: searchQuery || undefined,
        side: filterSide !== 'ALL' ? filterSide : undefined,
        result: filterResult !== 'ALL' ? filterResult : undefined,
        tag: filterTag !== 'ALL' ? filterTag : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
    };

    // React Query hook for fetching trades
    const { data, isFetching, isError, refetch } = useTrades(filters);
    const deleteTrade = useDeleteTrade();

    // Fetch tags for filter dropdown
    const { data: tagsData } = useTags();
    const tags = tagsData?.tags ?? [];

    // Derived state from React Query
    const trades = (data?.trades as JournalTrade[] | undefined) ?? [];
    const pagination = data?.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 1 };

    // Show error toast on fetch failure
    useEffect(() => {
        if (isError) {
            toast.error('Failed to load trades');
        }
    }, [isError]);

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

    // Debounced search to prevent excessive API calls
    const debouncedSearch = useDebouncedCallback((value: string) => {
        setSearchQuery(value);
        setPage(1); // Reset to page 1 on search
        updateUrlParams({ q: value || null });
    }, 300);

    // Update URL when filters change
    useEffect(() => {
        updateUrlParams({
            side: filterSide,
            result: filterResult,
            tag: filterTag !== 'ALL' ? filterTag : null,
            from: dateFrom || null,
            to: dateTo || null,
        });
    }, [filterSide, filterResult, filterTag, dateFrom, dateTo, updateUrlParams]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filterSide, filterResult, filterTag, dateFrom, dateTo]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        updateUrlParams({ page: newPage.toString() });
    };

    const handleView = (trade: JournalTrade) => {
        setSelectedTrade(trade);
        setIsViewModalOpen(true);
    };

    const handleEdit = (trade: JournalTrade) => {
        setSelectedTrade(trade);
        setIsEditModalOpen(true);
    };

    const handleViewModalClose = () => {
        setIsViewModalOpen(false);
        setSelectedTrade(null);
    };

    const handleEditModalClose = () => {
        setIsEditModalOpen(false);
        setSelectedTrade(null);
    };

    const handleSwitchToEdit = () => {
        setIsViewModalOpen(false);
        setIsEditModalOpen(true);
    };

    const handleTradeSaved = () => {
        // React Query will automatically refetch via invalidation
        refetch();
        setIsEditModalOpen(false);
        setSelectedTrade(null);
    };

    const handleTradeDeleted = async (id: string) => {
        try {
            await deleteTrade.mutateAsync(id);
            toast.success('Trade deleted');
            setIsEditModalOpen(false);
            setIsViewModalOpen(false);
            setSelectedTrade(null);
        } catch (err) {
            toast.error('Failed to delete trade');
        }
    };

    const handleTradeAdded = () => {
        // React Query will automatically refetch via invalidation
        refetch();
        setIsModalOpen(false);
    };

    const handleExportCsv = async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('q', searchQuery);
            if (filterSide !== 'ALL') params.set('side', filterSide);
            if (filterResult !== 'ALL') params.set('result', filterResult);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);

            const res = await fetch(`/api/trades/export?${params.toString()}`);
            if (!res.ok) throw new Error('Export failed');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            toast.error('Export failed');
        }
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

                    <div className="flex gap-3">
                        <button
                            onClick={handleExportCsv}
                            className="h-10 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shrink-0"
                        >
                            <Download size={14} /> Export CSV
                        </button>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="h-10 px-6 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:brightness-110 shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all active:scale-95 shrink-0"
                        >
                            <Plus size={14} /> New Record
                        </button>
                    </div>
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

                    {/* Tag Filter */}
                    {tags.length > 0 && (
                        <div className="glass-card flex items-center gap-1 border-white/5 bg-white/5 p-1">
                            <TagIcon size={12} className="text-gray-500 ml-1" />
                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] text-white font-bold uppercase tracking-widest cursor-pointer"
                            >
                                <option value="ALL" className="bg-gray-900">ALL TAGS</option>
                                {tags.map((tag) => (
                                    <option key={tag.id} value={tag.name} className="bg-gray-900">
                                        {tag.name.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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
                    {isFetching && !data ? (
                        <div className="divide-y divide-white/5">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonRow key={i} />
                            ))}
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
                        <DraggableTable data={trades} onView={handleView} onEdit={handleEdit} />
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

            <TradeViewModal
                trade={selectedTrade}
                isOpen={isViewModalOpen}
                onClose={handleViewModalClose}
                onEdit={handleSwitchToEdit}
            />

            <TradeEditModal
                trade={selectedTrade}
                isOpen={isEditModalOpen}
                onClose={handleEditModalClose}
                onSaved={handleTradeSaved}
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
