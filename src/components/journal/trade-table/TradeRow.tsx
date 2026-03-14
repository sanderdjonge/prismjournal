'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Trade, Column } from './types';

interface TradeRowProps {
    trade: Trade;
    columns: Column[];
    onAnalyze: (trade: Trade) => void;
}

// Helper function to calculate RR
function calcRR(trade: Trade): number | null {
    if (!trade.stopLoss || !trade.entry || trade.entry === 0) return null;
    const risk = Math.abs(trade.entry - trade.stopLoss);
    if (risk === 0) return null;
    if (!trade.exitTime) {
        // Open trade — show target RR if TP is set
        if (!trade.takeProfit) return null;
        return Math.abs(trade.takeProfit - trade.entry) / risk;
    }
    // Closed trade — show actual RR
    return trade.pnl >= 0
        ? Math.abs(trade.exit - trade.entry) / risk
        : -(Math.abs(trade.exit - trade.entry) / risk);
}

export function TradeRow({ trade, columns, onAnalyze }: TradeRowProps) {
    const rr = calcRR(trade);

    return (
        <tr key={trade.id} className="group hover:bg-white/[0.02] transition-colors">
            {columns.filter(c => c.visible).map((col) => (
                <td key={`${trade.id}-${col.id}`} className="px-4 py-2.5 whitespace-nowrap">
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
                        <span className={`text-xs font-black uppercase ${trade.type === 'BUY' ? 'text-accent' : 'text-danger'}`}>
                            {trade.type}
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
                    {col.id === 'actions' && (
                        <button
                            onClick={() => onAnalyze(trade)}
                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/20 transition-all"
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    )}
                </td>
            ))}
        </tr>
    );
}
