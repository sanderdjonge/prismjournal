'use client';

import type { JournalTrade } from '@/app/journal/page';

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
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-white/[0.06]" style={{ width: 268 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-500">Trade List</span>
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-600">{trades.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {trades.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-[9px] font-black uppercase tracking-widest text-gray-700">
                        No trades
                    </div>
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
                                isSelected ? 'bg-primary/[0.05]' : 'hover:bg-white/[0.03]'
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
                                    <span className="text-[9px] font-semibold text-gray-600 whitespace-nowrap flex-shrink-0">
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
                                            <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-gray-500 truncate">
                                                {zone}
                                            </span>
                                        )}
                                    </div>

                                    <span className={`font-mono text-[12px] font-bold flex-shrink-0 ${isWin ? 'text-profit' : 'text-loss'}`}>
                                        {pnlSign}${Math.abs(t.pnl).toFixed(0)}
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
