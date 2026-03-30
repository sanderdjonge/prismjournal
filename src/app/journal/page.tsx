'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import DashboardShell from '@/components/layout/DashboardShell';
import DraggableTable from '@/components/journal/DraggableTable';
import TradeViewModal from '@/components/journal/TradeViewModal';
import TradeEditModal from '@/components/journal/TradeEditModal';
import TradeEntryModal from '@/components/journal/TradeEntryModal';
import { JournalThreePanelView } from '@/components/journal/JournalThreePanelView';
import { SkeletonRow, ConfirmModal } from '@/components/ui';
import { useTrades, useDeleteTrade, TradeFilters } from '@/hooks/useTrades';
import { useTags } from '@/hooks/useTags';
import { useBulkOperations } from '@/hooks/useBulkOperations';
import { useAccounts } from '@/hooks/useAccounts';
import { useFilters, FilterConfig } from '@/hooks/useFilters';
import { FilterChipBar } from '@/components/filters/FilterChipBar';
import { Plus, ChevronLeft, ChevronRight, Download, Tag as TagIcon, Trash2, X, Wallet, LayoutGrid, Columns3 } from 'lucide-react';

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
    mae?: number | null;
    mfe?: number | null;
    screenshotCount?: number;
    entryRating?: number | null;
    exitRating?: number | null;
    managementRating?: number | null;
    rMultiple?: number | null;
};

const JOURNAL_FILTER_CONFIG: FilterConfig[] = [
  { id: 'side', label: 'Side', type: 'single-select', options: [
    { value: 'LONG', label: 'Long' }, { value: 'SHORT', label: 'Short' },
  ]},
  { id: 'result', label: 'Result', type: 'single-select', options: [
    { value: 'WIN', label: 'Win' }, { value: 'LOSS', label: 'Loss' }, { value: 'OPEN', label: 'Open' },
  ]},
  { id: 'closeReason', label: 'Close Reason', type: 'single-select', options: [
    { value: 'TP', label: 'TP' }, { value: 'SL', label: 'SL' }, { value: 'MANUAL', label: 'Manual' },
  ]},
  { id: 'tag', label: 'Tag', type: 'single-select' },
  { id: 'account', label: 'Account', type: 'single-select' },
  { id: 'dateRange', label: 'Date Range', type: 'date-range', paramKeys: ['from', 'to'] },
  { id: 'search', label: 'Search', type: 'text' },
]

function JournalContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const { activeFilters, addFilter, removeFilter, setMultiFilter, clearAll, getParam } = useFilters(JOURNAL_FILTER_CONFIG)

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

    // View mode state (table vs 3-panel)
    const [viewMode, setViewMode] = useState<'table' | 'panel'>('table');

    // Mobile detection — 3-panel requires ~900px minimum width
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    useEffect(() => {
        if (isMobile && viewMode === 'panel') setViewMode('table');
    }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAllSelected, setIsAllSelected] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

    // Bulk operations hook
    const { bulkDelete, bulkTag, bulkAccount, isDeleting } = useBulkOperations();
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

    // Account switcher (syncs with topnav)
    const { accounts } = useAccounts();

    // Build filters object for React Query
    const filters: TradeFilters = {
        q: getParam('search') || undefined,
        side: getParam('side') || undefined,
        result: getParam('result') || undefined,
        tag: activeFilters.find(f => f.id === 'tag')?.removeValue || undefined,
        closeReason: getParam('closeReason') || undefined,
        from: getParam('from') || undefined,
        to: getParam('to') || undefined,
        account: getParam('account') || undefined,
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

    // Reset to page 1 and clear selection when filters change
    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
        setIsAllSelected(false);
    }, [activeFilters]);

    // Clear bulk selection when switching to panel mode
    const handleViewModeChange = (mode: 'table' | 'panel') => {
        setViewMode(mode);
        if (mode === 'panel') {
            setSelectedIds(new Set());
            setIsAllSelected(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        setIsAllSelected(false);
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set('page', newPage.toString());
        const newUrl = newSearchParams.toString()
            ? `${'$'}{window.location.pathname}?${'$'}{newSearchParams.toString()}`
            : window.location.pathname;
        router.replace(newUrl, { scroll: false });
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
        localStorage.setItem('journal:perPage', String(newLimit));
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set('page', '1');
        const newUrl = newSearchParams.toString()
            ? `${'$'}{window.location.pathname}?${'$'}{newSearchParams.toString()}`
            : window.location.pathname;
        router.replace(newUrl, { scroll: false });
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
            const params = new URLSearchParams()
            if (getParam('search')) params.set('q', getParam('search')!)
            if (getParam('side')) params.set('side', getParam('side')!)
            if (getParam('result')) params.set('result', getParam('result')!)
            if (getParam('from')) params.set('from', getParam('from')!)
            if (getParam('to')) params.set('to', getParam('to')!)
            const tagValue = activeFilters.find(f => f.id === 'tag')?.removeValue
            if (tagValue) params.set('tag', tagValue)
            if (getParam('account')) params.set('account', getParam('account')!)
            const res = await fetch(`/api/trades/export?${'$'}{params.toString()}`);
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trades_${'$'}{new Date().toISOString().split('T')[0]}.csv`;
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
            const params = new URLSearchParams()
            if (getParam('search')) params.set('q', getParam('search')!)
            if (getParam('side')) params.set('side', getParam('side')!)
            if (getParam('result')) params.set('result', getParam('result')!)
            const tagValue = activeFilters.find(f => f.id === 'tag')?.removeValue
            if (tagValue) params.set('tag', tagValue)
            if (getParam('from')) params.set('from', getParam('from')!)
            if (getParam('to')) params.set('to', getParam('to')!)
            if (getParam('account')) params.set('account', getParam('account')!)
            params.set('idsOnly', 'true');
            const res = await fetch(`/api/trades?${'$'}{params.toString()}`);
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
                        {/* View Mode Toggle — hidden on mobile (3-panel requires ~900px) */}
                        {!isMobile && (
                        <div className="flex gap-[2px] bg-white/5 border border-white/10 rounded-xl p-[2px]">
                            <button
                                onClick={() => handleViewModeChange('table')}
                                className={`h-9 px-3 rounded-[10px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                    viewMode === 'table'
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <LayoutGrid size={14} /> Table
                            </button>
                            <button
                                onClick={() => handleViewModeChange('panel')}
                                className={`h-9 px-3 rounded-[10px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                    viewMode === 'panel'
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <Columns3 size={14} /> Panel
                            </button>
                        </div>
                        )}

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

                {/* Filter Chips */}
                <FilterChipBar
                  config={JOURNAL_FILTER_CONFIG}
                  activeFilters={activeFilters}
                  onAdd={addFilter}
                  onSetMulti={setMultiFilter}
                  onRemove={removeFilter}
                  onClear={clearAll}
                  dynamicOptions={{
                    tag: tags.map(t => ({ value: t.id, label: t.name })),
                    account: accounts.map(a => ({ value: a.id, label: a.name })),
                  }}
                />

                {/* Bulk Action Toolbar - only show in table mode */}
                {viewMode === 'table' && selectedIds.size > 0 && (
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

                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="h-8 px-4 rounded-lg bg-danger/10 border border-danger/20 text-danger font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-danger/20 transition-all"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content - Table or Panel View */}
                {viewMode === 'panel' ? (
                    <div className="glass-card border-white/5 bg-black/40 backdrop-blur-md overflow-hidden">
                        {isFetching && !data ? (
                            <div className="flex items-center justify-center h-[400px]">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 animate-pulse">Loading...</div>
                            </div>
                        ) : trades.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[400px] gap-3 text-gray-600">
                                <p className="text-[10px] font-black uppercase tracking-widest">No records found</p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                                >
                                    + Log your first trade
                                </button>
                            </div>
                        ) : (
                            <JournalThreePanelView trades={trades} />
                        )}
                    </div>
                ) : (
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
                )}

                {/* Pagination - only show in table mode */}
                {viewMode === 'table' && (pagination.totalPages > 1 || true) && (
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span>Rows</span>
                            {[10, 25, 50, 100].map(n => (
                                <button
                                    key={n}
                                    onClick={() => handleLimitChange(n)}
                                    className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${'$'}{limit === n ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-gray-500'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Page {page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === pagination.totalPages}
                                className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <TradeEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onTradeAdded={handleTradeAdded} />
            <TradeViewModal
                isOpen={isViewModalOpen}
                onClose={handleViewModalClose}
                trade={selectedTrade}
                onEdit={handleSwitchToEdit}
                onDelete={handleTradeDeleted}
            />
            <TradeEditModal
                isOpen={isEditModalOpen}
                onClose={handleEditModalClose}
                trade={selectedTrade}
                onSaved={handleTradeSaved}
            />
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title="Delete Selected Trades"
                message={`Are you sure you want to delete ${'$'}{selectedIds.size} trade${'$'}{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </DashboardShell>
    );
}

export default function JournalPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>}>
            <JournalContent />
        </Suspense>
    );
}
