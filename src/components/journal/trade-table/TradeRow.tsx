'use client';

import React from 'react';
import { Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Trade, Column } from './types';
import { calcRR } from '@/lib/tradeCalculations';

interface TradeRowProps {
    trade: Trade;
    columns: Column[];
    onView: (trade: Trade) => void;
    onEdit: (trade: Trade) => void;
    isSelected?: boolean;
    onToggleSelect?: (tradeId: string) => void;
}

export function TradeRow({ trade, columns, onView, onEdit, isSelected = false, onToggleSelect }: TradeRowProps) {
    const rr = calcRR(trade);

    return (
        <tr key={trade.id} className={cn(
            "group hover:bg-white/[0.02] transition-colors",
            isSelected && "bg-primary/5"
        )}>
            {columns.filter(c => c.visible).map((col) => (
                <td
                    key={`${trade.id}-${col.id}`}
                    className={cn(
                        "px-4 py-2.5 whitespace-nowrap",
                        !col.mobileVisible && "hidden md:table-cell"
                    )}
                >
                    {col.id === 'select' && onToggleSelect && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(trade.id)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                    {col.id === 'time' && (
                        <div className="text-xs text-gray-300">
                            {trade.entryTime ? new Date(trade.entryTime).toLocaleDateString() : '—'}
                            <div className="text-[10px] text-gray-600">
                                {trade.entryTime ? new Date(trade.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                    )}
                    {col.id === 'exitTime' && (
                        <div className="text-xs text-gray-300">
                            {trade.exitTime ? new Date(trade.exitTime).toLocaleDateString() : '—'}
                            <div className="text-[10px] text-gray-600">
                                {trade.exitTime ? new Date(trade.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                    )}
                    {col.id === 'ticket' && (
                        <span className="text-gray-500 font-mono text-[10px]">{trade.ticket}</span>
                    )}
                    {col.id === 'symbol' && (
                        <span className="font-bold text-sm text-white tracking-tight">{trade.symbol}</span>
                    )}
                    {col.id === 'side' && (
                        <span className={`text-xs font-black uppercase ${trade.type === 'LONG' ? 'text-accent' : 'text-danger'}`}>
                            {trade.type === 'LONG' ? 'Long' : 'Short'}
                        </span>
                    )}
                    {col.id === 'status' && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            trade.exitTime
                                ? 'bg-white/5 text-gray-500'
                                : 'bg-secondary/10 text-secondary'
                        }`}>
                            {trade.exitTime ? 'Closed' : 'Open'}
                        </span>
                    )}
                    {col.id === 'volume' && (
                        <span className="text-xs font-bold text-white/80">{trade.volume.toFixed(2)}</span>
                    )}
                    {col.id === 'sl' && (
                        <span className="text-xs text-gray-500">{trade.stopLoss ? trade.stopLoss.toFixed(2) : '—'}</span>
                    )}
                    {col.id === 'tp' && (
                        <span className="text-xs text-gray-500">{trade.takeProfit ? trade.takeProfit.toFixed(2) : '—'}</span>
                    )}
                    {col.id === 'result' && (
                        <span className={`font-black text-xs ${trade.pnl >= 0 ? 'text-accent' : 'text-danger'}`}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </span>
                    )}
                    {col.id === 'rr' && (
                        <span className={`text-xs font-bold ${
                            rr === null ? 'text-gray-600' :
                            rr >= 0 ? 'text-accent' : 'text-danger'
                        }`}>
                            {rr !== null ? `${rr >= 0 ? '' : ''}${rr.toFixed(1)}R` : '—'}
                        </span>
                    )}
                    {col.id === 'tags' && (
                        <div className="flex gap-1 flex-wrap">
                            {trade.tags && trade.tags.length > 0 ? (
                                trade.tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                                        style={{
                                            backgroundColor: `${tag.color || '#00f2ff'}20`,
                                            color: tag.color || '#00f2ff',
                                        }}
                                    >
                                        {tag.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-gray-600 text-[10px]">—</span>
                            )}
                        </div>
                    )}
                    {col.id === 'account' && (
                        <span className="text-xs text-gray-400 truncate max-w-[120px] block">
                            {trade.accountName || '—'}
                        </span>
                    )}
                    {col.id === 'actions' && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => onView(trade)}
                                className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-secondary hover:border-secondary/20 transition-all"
                                title="View"
                            >
                                <Eye size={14} />
                            </button>
                            <button
                                onClick={() => onEdit(trade)}
                                className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/20 transition-all"
                                title="Edit"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    )}
                </td>
            ))}
        </tr>
    );
}
