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
import { SkeletonRow, ConfirmModal } from '@/components/ui';
import { useTrades, useDeleteTrade, TradeFilters } from '@/hooks/useTrades';
import { useTags } from '@/hooks/useTags';
import { useBulkOperations } from '@/hooks/useBulkOperations';
import { useAccounts } from '@/hooks/useAccounts';
import { Search, Plus, Calendar, ChevronLeft, ChevronRight, Download, Tag as TagIcon, Trash2, X, Wallet } from 'lucide-react';

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
    closeReason?: string | null;
    notes?: string | null;
    strategy?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
    tags?: { id: string; name: string; color?: string | null }[];
    accountName?: string | null;
    accountId?: string | null;
};

function JournalContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Filter state (kept as-is to feed into query key)
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [filterSide, setFilterSide] = useState<string>(searchParams.get('side') || 'ALL');
    const [filterResult, setFilterResult] = useState<string>(searchParams.get('result') || 'ALL');
    const [filterTag, setFilterTag] = useState<string>(searchParams.get('tag') || 'ALL');
    const [filterCloseReason, setFilterCloseReason] = useState<string>(searchParams.get('closeReason') || 'ALL');
    const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
    const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
    const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [limit, setLimit] = useState<number>(() => {
        if (typeof window === 'undefined') return 25;
        return parseInt(localStorage.getItem('journal:perPage') || '25');
    });

    // Modal state
    const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAllSelected, setIsAllSelected] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

    // Bulk operations hook
    const { bulkDelete, bulkTag, bulkAccount, isDeleting } = useBulkOperations();
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

    // Account switcher (syncs with topnav)
    const { accounts, selectedAccountId, selectAccount } = useAccounts();

    // Build filters object for React Query
    const filters: TradeFilters = {
        q: searchQuery || undefined,
        side: filterSide !== 'ALL' ? filterSide : undefined,
        result: filterResult !== 'ALL' ? filterResult : undefined,
        tag: filterTag !== 'ALL' ? filterTag : undefined,
        closeReason: filterCloseReason !== 'ALL' ? filterCloseReason : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        account: selectedAccountId || undefined,
        page,
        limit,
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

    // Reset to page 1 and clear selection when filters change
    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
        setIsAllSelected(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filterSide, filterResult, filterTag, dateFrom, dateTo, selectedAccountId]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        setIsAllSelected(false);
        updateUrlParams({ page: newPage.toString() });
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
        localStorage.setItem('journal:perPage', String(newLimit));
        updateUrlParams({ page: '1' });
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
        refetch();
        setIsEditModalOpen(false);
        setSelectedTrade(null);
        setSelectedIds(new Set());
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

    // Bulk selection handlers
    const handleToggleSelect = (tradeId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(tradeId)) {
                next.delete(tradeId);
            } else {
                next.add(tradeId);
            }
            return next;
        });
    };

    const handleSelectAll = async () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
            setIsAllSelected(false);
            return;
        }
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('q', searchQuery);
            if (filterSide !== 'ALL') params.set('side', filterSide);
            if (filterResult !== 'ALL') params.set('result', filterResult);
            if (filterTag !== 'ALL') params.set('tag', filterTag);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            if (selectedAccountId) params.set('account', selectedAccountId);
            params.set('idsOnly', 'true');
            const res = await fetch(`/api/trades?${params.toString()}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setSelectedIds(new Set(data.ids));
            setIsAllSelected(true);
        } catch {
            toast.error('Failed to select all trades');
        }
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
        setIsAllSelected(false);
    };

    const handleBulkDelete = async () => {
        try {
            await bulkDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
            setIsDeleteModalOpen(false);
        } catch {
            // Error handled in hook
        }
    };

    const handleBulkAccount = async (accountId: string) => {
        try {
            await bulkAccount({ tradeIds: Array.from(selectedIds), accountId });
            setAccountDropdownOpen(false);
            setSelectedIds(new Set());
        } catch {
            // Error handled in hook
        }
    };

    const handleBulkTag = async (tagId: string) => {
        try {
            await bulkTag({ tradeIds: Array.from(selectedIds), tagId });
            setTagDropdownOpen(false);
        } catch {
            // Error handled in hook
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
                        {['ALL', 'LONG', 'SHORT'].map(type => (
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
                                    ? type === 'WIN' ? 'bg-profit/20 text-profit' :
                                      type === 'LOSS' ? 'bg-loss/20 text-loss' :
                                      type === 'OPEN' ? 'bg-secondary/20 text-secondary' :
                                      'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                    : 'text-gray-600 hover:text-gray-400'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Close Reason Filter */}
                    <div className="glass-card flex items-center gap-1 border-white/5 bg-white/5 p-1">
                        {(['ALL', 'TP', 'SL', 'MANUAL'] as const).map(cr => (
                            <button
                                key={cr}
                                onClick={() => setFilterCloseReason(cr)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterCloseReason === cr
                                    ? cr === 'TP'     ? 'bg-emerald-500/20 text-emerald-400'
                                    : cr === 'SL'     ? 'bg-red-500/20 text-red-400'
                                    : cr === 'MANUAL' ? 'bg-white/10 text-gray-300'
                                    : 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                    : 'text-gray-600 hover:text-gray-400'
                                }`}
                            >
                                {cr}
                            </button>
                        ))}
                    </div>

                    {/* Account Filter */}
                    {accounts.length > 1 && (
                        <div className="glass-card flex items-center gap-1 border-white/5 bg-white/5 p-1">
                            <Wallet size={12} className="text-gray-500 ml-1" />
                            <select
                                value={selectedAccountId || ''}
                                onChange={(e) => selectAccount(e.target.value || null)}
                                className="bg-transparent border-none outline-none text-[10px] text-white font-bold uppercase tracking-widest cursor-pointer"
                            >
                                <option value="" className="bg-gray-900">ALL ACCOUNTS</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id} className="bg-gray-900">
                                        {acc.name.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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
                                    <option key={tag.id} value={tag.id} className="bg-gray-900">
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

                {/* Bulk Action Toolbar */}
                {selectedIds.size > 0 && (
                    <div className="glass-card border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between overflow-visible relative z-[50]">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                {selectedIds.size} trade{selectedIds.size !== 1 ? 's' : ''} selected
                            </span>
                            <button
                                onClick={handleClearSelection}
                                className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                            >
                                <X size={12} /> Clear
                            </button>
                            {selectedIds.size > 0 && !isAllSelected && pagination.total > selectedIds.size && (
                                <button
                                    onClick={handleSelectAll}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                                >
                                    Select all {pagination.total} trades
                                </button>
                            )}
                            {isAllSelected && (
                                <button
                                    onClick={() => { setSelectedIds(new Set()); setIsAllSelected(false); }}
                                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
                                >
                                    Clear selection
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Move to Account Dropdown */}
                            {accounts.length > 1 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                                        className="h-8 px-4 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-white/10 transition-all"
                                    >
                                        <Wallet size={12} /> Move to Account
                                    </button>
                                    {accountDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-1 glass-card border-white/10 bg-gray-900/95 rounded-lg overflow-hidden z-[500] min-w-[180px]">
                                            {accounts.map((acc) => (
                                                <button
                                                    key={acc.id}
                                                    onClick={() => handleBulkAccount(acc.id)}
                                                    className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 text-gray-300 hover:text-white flex items-center gap-2"
                                                >
                                                    {acc.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tag Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                                    className="h-8 px-4 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-white/10 transition-all"
                                >
                                    <TagIcon size={12} /> Add Tag
                                </button>
                                {tagDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-1 glass-card border-white/10 bg-gray-900/95 rounded-lg overflow-hidden z-[500] min-w-[150px]">
                                        {tags.length === 0 ? (
                                            <div className="px-3 py-2 text-[10px] text-gray-500">No tags available</div>
                                        ) : (
                                            tags.map((tag) => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => {
                                                        handleBulkTag(tag.id);
                                                        setTagDropdownOpen(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-2"
                                                    style={{ color: tag.color || '#00f2ff' }}
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: tag.color || '#00f2ff' }}
                                                    />
                                                    {tag.name}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Delete Button */}
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="h-8 px-4 rounded-lg bg-danger/10 border border-danger/20 text-danger font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-danger/20 transition-all"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    </div>
                )}

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
                        <DraggableTable
                            data={trades}
                            onView={handleView}
                            onEdit={handleEdit}
                            selectedIds={selectedIds}
                            onToggleSelect={handleToggleSelect}
                            onSelectAll={handleSelectAll}
                        />
                    )}
                </div>

                {/* Pagination */}
                {(pagination.totalPages > 1 || true) && (
                    <div className="flex items-center justify-center gap-4">
                        {/* Per-page selector */}
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span>Rows</span>
                            {[10, 25, 50, 100].map(n => (
                                <button
                                    key={n}
                                    onClick={() => handleLimitChange(n)}
                                    className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${limit === n ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-gray-500'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        {pagination.totalPages > 1 && <>
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
                        </>}
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-2">
                            {pagination.total > 0 ? `${pagination.total} trades` : ''}
                        </span>
                    </div>
                )}

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

            {/* Bulk Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title="Delete Trades"
                message={`Are you sure you want to delete ${selectedIds.size} trade${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
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
