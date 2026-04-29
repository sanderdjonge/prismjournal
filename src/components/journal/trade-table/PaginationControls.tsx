'use client';

import React from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
}

export function PaginationControls({
    currentPage,
    totalPages,
    totalItems,
    perPage,
    onPageChange,
    onPerPageChange,
}: PaginationControlsProps) {
    const startItem = totalItems === 0 ? 0 : currentPage * perPage + 1;
    const endItem = Math.min((currentPage + 1) * perPage, totalItems);

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Per page:</span>
                {[10, 20, 50, 100].map(n => (
                    <button
                        key={n}
                        onClick={() => onPerPageChange(n)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                            perPage === n
                                ? 'bg-primary/10 text-primary'
                                : 'text-text-muted hover:text-text-muted'
                        }`}
                    >
                        {n}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted mr-2">
                    {totalItems === 0 ? '0 of 0' : `${startItem}–${endItem} of ${totalItems}`}
                </span>
                <span className="text-[10px] text-text-muted mr-2">
                    Page {currentPage + 1} / {totalPages}
                </span>
                <button 
                    onClick={() => onPageChange(0)} 
                    disabled={currentPage === 0}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronsLeft size={14} />
                </button>
                <button 
                    onClick={() => onPageChange(Math.max(0, currentPage - 1))} 
                    disabled={currentPage === 0}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft size={14} />
                </button>
                <button 
                    onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))} 
                    disabled={currentPage >= totalPages - 1}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight size={14} />
                </button>
                <button 
                    onClick={() => onPageChange(totalPages - 1)} 
                    disabled={currentPage >= totalPages - 1}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronsRight size={14} />
                </button>
            </div>
        </div>
    );
}
