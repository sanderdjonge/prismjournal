'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import {
    TableHeader,
    TradeRow,
    ColumnVisibilityToggle,
    type Column,
    type Trade,
    type SortDir,
    DEFAULT_COLUMNS,
    STORAGE_KEY_COLUMNS,
    STORAGE_KEY_SORT,
} from './trade-table';
import { calcRROrZero } from '@/lib/tradeCalculations';
import { useSettings } from '@/hooks/useSettings';

// Helper function to get sort value
function getSortValue(trade: Trade, col: string): string | number {
    switch (col) {
        case 'time': return trade.entryTime ?? '';
        case 'exitTime': return trade.exitTime ?? '';
        case 'symbol': return trade.symbol;
        case 'ticket': return trade.ticket;
        case 'side': return trade.type;
        case 'volume': return trade.volume;
        case 'result': return trade.pnl;
        case 'tp': return trade.takeProfit ?? 0;
        case 'sl': return trade.stopLoss ?? 0;
        case 'status': return trade.exitTime ? 1 : 0;
        case 'rr': return calcRROrZero(trade);
        case 'strategy': return trade.strategy ?? '';
        case 'account': return trade.accountName ?? '';
        case 'tags': return trade.tags?.[0]?.name ?? '';
        case 'screenshots': return trade.screenshotCount ?? 0;
        case 'closeReason': return trade.closeReason ?? '';
        default: return 0;
    }
}

interface DraggableTableProps {
    data: Trade[];
    onView: (trade: Trade) => void;
    onEdit: (trade: Trade) => void;
    selectedIds?: Set<string>;
    onToggleSelect?: (tradeId: string) => void;
    onSelectAll?: () => void;
}

export default function DraggableTable({ data, onView, onEdit, selectedIds, onToggleSelect, onSelectAll }: DraggableTableProps) {
    const { timezone } = useSettings();
    // Lazy state initialization from localStorage to avoid useEffect setState issues
    const [columns, setColumns] = useState<Column[]>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMNS;
        try {
            const savedCols = localStorage.getItem(STORAGE_KEY_COLUMNS);
            if (savedCols) {
                const parsed = JSON.parse(savedCols) as Column[];
                // Merge with defaults to pick up new columns
                return DEFAULT_COLUMNS.map(def => {
                    const saved = parsed.find(p => p.id === def.id);
                    return saved ? { ...def, visible: saved.visible } : def;
                });
            }
        } catch { /* ignore */ }
        return DEFAULT_COLUMNS;
    });
    
    const [sortCol, setSortCol] = useState(() => {
        if (typeof window === 'undefined') return 'time';
        try {
            const savedSort = localStorage.getItem(STORAGE_KEY_SORT);
            if (savedSort) {
                const { col } = JSON.parse(savedSort);
                return col;
            }
        } catch { /* ignore */ }
        return 'time';
    });
    
    const [sortDir, setSortDir] = useState<SortDir>(() => {
        if (typeof window === 'undefined') return 'desc';
        try {
            const savedSort = localStorage.getItem(STORAGE_KEY_SORT);
            if (savedSort) {
                const { dir } = JSON.parse(savedSort);
                return dir;
            }
        } catch { /* ignore */ }
        return 'desc';
    });
    

    // Track mounted state using useSyncExternalStore pattern (no setState in effect)
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );

    const saveColumns = (newCols: Column[]) => {
        setColumns(newCols);
        localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(newCols));
    };

    const toggleColumn = (id: string) => {
        const newCols = columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
        saveColumns(newCols);
    };

    const handleSort = (colId: string) => {
        const col = columns.find(c => c.id === colId);
        if (!col?.sortable) return;
        const newDir: SortDir = sortCol === colId && sortDir === 'desc' ? 'asc' : 'desc';
        setSortCol(colId);
        setSortDir(newDir);
        localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify({ col: colId, dir: newDir }));
    };

    // Sort data
    const sorted = useMemo(() => {
        const arr = [...data];
        arr.sort((a, b) => {
            const va = getSortValue(a, sortCol);
            const vb = getSortValue(b, sortCol);
            if (typeof va === 'string' && typeof vb === 'string') {
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            const na = va as number, nb = vb as number;
            return sortDir === 'asc' ? na - nb : nb - na;
        });
        return arr;
    }, [data, sortCol, sortDir]);

    // Selection state for header
    const allSelected = sorted.length > 0 && sorted.every(t => selectedIds?.has(t.id));
    const someSelected = sorted.some(t => selectedIds?.has(t.id));

    if (!mounted) return null;

    return (
        <div className="space-y-0">
            {/* Column Configuration Bar */}
            <ColumnVisibilityToggle 
                columns={columns} 
                onToggleColumn={toggleColumn} 
            />

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <TableHeader
                        columns={columns}
                        onReorderColumns={saveColumns}
                        sortCol={sortCol}
                        sortDir={sortDir}
                        onSort={handleSort}
                        allSelected={allSelected}
                        someSelected={someSelected}
                        onSelectAll={onSelectAll}
                    />
                    <tbody className="divide-y divide-white/5">
                        {sorted.map((trade) => (
                            <TradeRow
                                key={trade.id}
                                trade={trade}
                                columns={columns}
                                onView={onView}
                                onEdit={onEdit}
                                isSelected={selectedIds?.has(trade.id)}
                                onToggleSelect={onToggleSelect}
                                timezone={timezone}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
