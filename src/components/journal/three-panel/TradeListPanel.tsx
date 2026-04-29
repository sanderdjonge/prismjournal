'use client';

import type { JournalTrade } from '@/app/journal/page';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDecimals } from '@/lib/formatNumber';

// ── Exported utilities (tested in __tests__/tradeListUtils.test.ts) ─────────

export function computeDuration(
    entryTime: string | null | undefined,
    exitTime: string | null | undefined,
): string | null {
    if (!entryTime || !exitTime) return null;
    const ms = new Date(exitTime).getTime() - new Date(entryTime).getTime();
    if (ms <= 0) return null;
    const mins = Math.floor(ms / 60_000);
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours === 0) return `${mins}m`;
    if (rem === 0) return `${hours}h`;
    return `${hours}h ${rem}m`;
}

export function deriveListZone(trade: JournalTrade): string | null {
    const { mae, mfe, entry, exit, type, pnl } = trade;
    if (!mae || !mfe || mae <= 0 || mfe <= 0 || exit == null || exit === 0) return null;
    const exitDist = type === 'LONG' ? exit - entry : entry - exit;
    const eff = Math.min(100, Math.max(0, ((mae + exitDist) / (mae + mfe)) * 100));
    if (pnl < 0) return 'Painful';
    if (eff >= 66) return 'Clean';
    if (eff >= 33) return 'EarlyOut';
    return 'Survived';
}

// ── Component ────────────────────────────────────────────────────────────────

interface TradeListPanelProps {
    trades: JournalTrade[];
    selectedId: string | null;
    onSelect: (trade: JournalTrade) => void;
}

export function TradeListPanel({ trades, selectedId, onSelect }: TradeListPanelProps) {
    return (
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-border-subtle" style={{ width: 268 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">Trade List</span>
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">{trades.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {trades.length === 0 && (
                    <EmptyState title="No trades" className="py-6" />
                )}

                {trades.map(t => {
                    const isWin = t.pnl >= 0;
                    const isSelected = t.id === selectedId;
                    const zone = deriveListZone(t);
                    const pnlSign = isWin ? '+' : '-';

                    const dateStr = t.entryTime
                        ? new Date(t.entryTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                        : t.time;
                    const timeStr = t.entryTime
                        ? new Date(t.entryTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : '';

                    return (
                        <button
                            key={t.id}
                            onClick={() => onSelect(t)}
                            className={`relative w-full text-left flex border-b border-white/[0.03] transition-colors ${
                                isSelected ? 'bg-primary/[0.05]' : 'hover:bg-surface-hover'
                            }`}
                        >
                            {/* Left colour bar */}
                            <div className={`w-[3px] flex-shrink-0 self-stretch ${isWin ? 'bg-profit' : 'bg-loss'}`} />

                            {/* Right edge indicator when selected */}
                            {isSelected && (
                                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-primary" />
                            )}

                            <div className="flex-1 min-w-0 px-3 py-[7px]">
                                {/* Line 1: symbol (left) + date (right) */}
                                <div className="flex items-baseline justify-between gap-1">
                                    <span className="font-mono text-[13px] font-bold text-white tracking-[0.04em] truncate">
                                        {t.symbol}
                                    </span>
                                    <span className="text-[9px] font-semibold text-text-muted whitespace-nowrap flex-shrink-0">
                                        {dateStr}{timeStr ? ` · ${timeStr}` : ''}
                                    </span>
                                </div>

                                {/* Line 2: dir + zone (left) + pnl (right) */}
                                <div className="flex items-center justify-between gap-1 mt-[3px]">
                                    <div className="flex items-center gap-[5px] min-w-0">
                                        <span className={`text-[9px] font-black uppercase tracking-[0.08em] px-[5px] py-[1px] rounded-[3px] ${
                                            t.type === 'LONG'
                                                ? 'bg-profit/15 text-profit'
                                                : 'bg-loss/15 text-loss'
                                        }`}>
                                            {t.type}
                                        </span>
                                        {zone && (
                                            <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted truncate">
                                                {zone}
                                            </span>
                                        )}
                                    </div>

                                    <span className={`font-mono text-[12px] font-bold flex-shrink-0 ${isWin ? 'text-profit' : 'text-loss'}`}>
                                        {pnlSign}${fmtDecimals(Math.abs(t.pnl), 2)}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
