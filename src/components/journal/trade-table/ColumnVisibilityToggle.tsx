'use client';

import React from 'react';
import type { Column } from './types';

interface ColumnVisibilityToggleProps {
    columns: Column[];
    onToggleColumn: (id: string) => void;
}

export function ColumnVisibilityToggle({ columns, onToggleColumn }: ColumnVisibilityToggleProps) {
    return (
        <div className="flex items-center gap-4 px-4 overflow-x-auto py-3 border-b border-white/5 no-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 shrink-0">Columns:</span>
            {columns.map(col => col.id !== 'actions' && col.id !== 'select' && (
                <button
                    key={col.id}
                    onClick={() => onToggleColumn(col.id)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                        col.visible
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-white/5 text-gray-500 border-white/5 opacity-50"
                    }`}
                >
                    {col.label}
                </button>
            ))}
        </div>
    );
}
