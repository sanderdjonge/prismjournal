'use client';

import React from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import type { Column, SortDir } from './types';

interface TableHeaderProps {
    columns: Column[];
    onReorderColumns: (columns: Column[]) => void;
    sortCol: string;
    sortDir: SortDir;
    onSort: (colId: string) => void;
}

export function TableHeader({ 
    columns, 
    onReorderColumns, 
    sortCol, 
    sortDir, 
    onSort 
}: TableHeaderProps) {
    return (
        <thead className="bg-white/5">
            <Reorder.Group
                axis="x"
                values={columns}
                onReorder={onReorderColumns}
                as="tr"
                className="text-[10px] font-black uppercase tracking-widest text-gray-500"
            >
                {columns.filter(c => c.visible).map((col) => (
                    <Reorder.Item
                        key={col.id}
                        value={col}
                        as="th"
                        className={`px-4 py-3 select-none ${col.sortable ? 'cursor-pointer hover:bg-white/5' : 'cursor-grab active:cursor-grabbing'} transition-colors`}
                        onClick={() => col.sortable && onSort(col.id)}
                    >
                        <div className="flex items-center gap-1.5">
                            {!col.sortable && <GripVertical size={10} className="text-gray-700" />}
                            {col.label}
                            {col.sortable && sortCol === col.id && (
                                sortDir === 'desc'
                                    ? <ChevronDown size={12} className="text-primary" />
                                    : <ChevronUp size={12} className="text-primary" />
                            )}
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </thead>
    );
}
