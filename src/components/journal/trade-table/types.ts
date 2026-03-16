export interface Tag {
    id: string;
    name: string;
    color?: string | null;
}

export interface Column {
    id: string;
    label: string;
    visible: boolean;
    sortable: boolean;
    /** Whether this column is visible on mobile (< 768px) */
    mobileVisible?: boolean;
}

export interface Trade {
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
    tags?: Tag[];
    accountName?: string | null;
}

export type SortDir = 'asc' | 'desc';

export const DEFAULT_COLUMNS: Column[] = [
    { id: 'select', label: '', visible: true, sortable: false, mobileVisible: true },
    { id: 'time', label: 'Entry Date', visible: true, sortable: true, mobileVisible: false },
    { id: 'exitTime', label: 'Exit Date', visible: true, sortable: true, mobileVisible: false },
    { id: 'symbol', label: 'Symbol', visible: true, sortable: true, mobileVisible: true },
    { id: 'ticket', label: 'Ticket', visible: true, sortable: true, mobileVisible: false },
    { id: 'side', label: 'Type', visible: true, sortable: true, mobileVisible: true },
    { id: 'volume', label: 'Volume', visible: true, sortable: true, mobileVisible: false },
    { id: 'result', label: 'P&L', visible: true, sortable: true, mobileVisible: true },
    { id: 'tp', label: 'TP', visible: true, sortable: true, mobileVisible: false },
    { id: 'sl', label: 'SL', visible: true, sortable: true, mobileVisible: false },
    { id: 'status', label: 'Status', visible: true, sortable: true, mobileVisible: false },
    { id: 'rr', label: 'RR', visible: true, sortable: true, mobileVisible: false },
    { id: 'tags', label: 'Tags', visible: true, sortable: true, mobileVisible: false },
    { id: 'account', label: 'Account', visible: false, sortable: true, mobileVisible: false },
    { id: 'actions', label: '', visible: true, sortable: false, mobileVisible: true },
];

export const STORAGE_KEY_COLUMNS = 'prism_journal_columns_v2';
export const STORAGE_KEY_PER_PAGE = 'prism_journal_per_page';
export const STORAGE_KEY_SORT = 'prism_journal_sort';
