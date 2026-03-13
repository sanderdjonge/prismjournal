export interface Column {
    id: string;
    label: string;
    visible: boolean;
    sortable: boolean;
}

export interface Trade {
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
}

export type SortDir = 'asc' | 'desc';

export const DEFAULT_COLUMNS: Column[] = [
    { id: 'time', label: 'Date/Time', visible: true, sortable: true },
    { id: 'symbol', label: 'Symbol', visible: true, sortable: true },
    { id: 'ticket', label: 'Ticket', visible: true, sortable: true },
    { id: 'side', label: 'Type', visible: true, sortable: true },
    { id: 'volume', label: 'Volume', visible: true, sortable: true },
    { id: 'result', label: 'P&L', visible: true, sortable: true },
    { id: 'tp', label: 'TP', visible: true, sortable: true },
    { id: 'sl', label: 'SL', visible: true, sortable: true },
    { id: 'status', label: 'Status', visible: true, sortable: true },
    { id: 'rr', label: 'RR', visible: true, sortable: true },
    { id: 'actions', label: '', visible: true, sortable: false },
];

export const STORAGE_KEY_COLUMNS = 'prism_journal_columns_v2';
export const STORAGE_KEY_PER_PAGE = 'prism_journal_per_page';
export const STORAGE_KEY_SORT = 'prism_journal_sort';
