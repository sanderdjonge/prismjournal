'use client';

import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { computeDuration } from './TradeListPanel';
import type { JournalTrade } from '@/app/journal/page';
import { formatPercent, fmtDecimals } from '@/lib/formatNumber';

import type { MediaItem } from '@/types/trade'

interface ScreenshotPanelProps {
    trade: JournalTrade | null;
}

const TF_ORDER = ['1M', '5M', '15M', '30M', '1H', '4H', 'D1'];

function sortTimeframes(tfs: string[]): string[] {
    return [...tfs].sort((a, b) => {
        const ia = TF_ORDER.indexOf(a.toUpperCase());
        const ib = TF_ORDER.indexOf(b.toUpperCase());
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

export function ScreenshotPanel({ trade }: ScreenshotPanelProps) {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<'OPEN' | 'CLOSE'>('OPEN');
    const [selectedTf, setSelectedTf] = useState<string>('');

    // Fetch media when trade changes
    useEffect(() => {
        if (!trade) { setMedia([]); setError(false); return; }
        setLoading(true);
        setError(false);
        fetch(`/api/trades/${trade.id}`)
            .then(r => r.json())
            .then(d => { setMedia(d.media ?? []); setLoading(false); })
            .catch(() => { setLoading(false); setError(true); });
    }, [trade?.id]);

    // Available timeframes for the selected event
    const timeframes = sortTimeframes(
        [...new Set(media.filter(m => m.event === selectedEvent).map(m => m.timeframe))]
    );

    // Auto-select first available timeframe when event or media changes
    useEffect(() => {
        if (timeframes.length > 0 && !timeframes.includes(selectedTf)) {
            setSelectedTf(timeframes[0]);
        }
    }, [media, selectedEvent]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-switch event if current event has no screenshots
    useEffect(() => {
        if (media.length > 0) {
            const hasOpen = media.some(m => m.event === 'OPEN');
            const hasClose = media.some(m => m.event === 'CLOSE');
            if (selectedEvent === 'OPEN' && !hasOpen && hasClose) {
                setSelectedEvent('CLOSE');
            } else if (selectedEvent === 'CLOSE' && !hasClose && hasOpen) {
                setSelectedEvent('OPEN');
            }
        }
    }, [media, selectedEvent]);

    const activeShot = media.find(m => m.event === selectedEvent && m.timeframe === selectedTf);

    const duration = trade ? computeDuration(trade.entryTime, trade.exitTime) : null;

    const rr = trade?.rMultiple != null
        ? `R:${fmtDecimals(trade.rMultiple, 2)}`
        : null;

    const eff = (trade?.mae && trade?.mfe && trade.mae > 0 && trade.mfe > 0 && trade.exit && trade.exit > 0)
        ? Math.min(100, Math.max(0, ((trade.mae + (trade.type === 'LONG' ? trade.exit - trade.entry : trade.entry - trade.exit)) / (trade.mae + trade.mfe)) * 100))
        : null;

    return (
        <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-black/40">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-500">Chart</span>
                <div className="flex items-center gap-2">
                    {/* OPEN / CLOSE event toggle */}
                    <div className="flex gap-[2px] bg-black/30 border border-white/[0.08] rounded-[7px] p-[2px]">
                        {(['OPEN', 'CLOSE'] as const).map(ev => (
                            <button
                                key={ev}
                                type="button"
                                onClick={() => setSelectedEvent(ev)}
                                className={`px-2 py-[2px] rounded-[5px] text-[9px] font-black uppercase tracking-[0.12em] transition-all ${
                                    selectedEvent === ev
                                        ? 'bg-white/[0.08] text-white'
                                        : 'text-gray-600 hover:text-gray-400'
                                }`}
                            >
                                {ev}
                            </button>
                        ))}
                    </div>
                    {/* Timeframe tabs */}
                    <div className="flex gap-[2px]">
                        {timeframes.map(tf => (
                            <button
                                key={tf}
                                type="button"
                                onClick={() => setSelectedTf(tf)}
                                className={`px-2 py-[3px] rounded-[5px] text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                                    selectedTf === tf
                                        ? 'bg-primary/[0.12] text-primary'
                                        : 'text-gray-600 hover:text-white hover:bg-white/[0.05]'
                                }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Screenshot area */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center">
                {loading && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-700 animate-pulse">
                        Loading…
                    </div>
                )}

                {!loading && error && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-red-400">
                        Failed to load screenshots
                    </div>
                )}

                {!loading && !error && !activeShot && (
                    <div className="flex flex-col items-center gap-3 text-gray-700">
                        <ImageOff size={28} strokeWidth={1.5} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                            {media.length === 0
                                ? 'No screenshots captured'
                                : `No ${selectedEvent.toLowerCase()} screenshot for this timeframe`}
                        </span>
                    </div>
                )}

                {!loading && !error && activeShot && (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={activeShot.url}
                            alt={`${trade?.symbol} ${activeShot.event} ${activeShot.timeframe}`}
                            className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-500 bg-black/60 border border-white/[0.08] rounded-[5px] px-2 py-1">
                            📷 Auto-captured at trade {selectedEvent.toLowerCase()}
                        </div>
                    </>
                )}
            </div>

            {/* Footer stats bar */}
            {trade && (
                <div className="flex items-center justify-around px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
                    {[
                        { val: rr ?? '—', lbl: 'R Multiple', color: trade.pnl >= 0 ? 'text-profit' : 'text-loss' },
                        { val: duration ?? '—', lbl: 'Hold Time', color: 'text-white' },
                        { val: eff != null ? formatPercent(eff, 0) : '—', lbl: 'Efficiency', color: 'text-white' },
                        { val: trade.closeReason ?? '—', lbl: 'Close Reason', color: 'text-white' },
                    ].map(({ val, lbl, color }) => (
                        <div key={lbl} className="flex flex-col items-center gap-[3px]">
                            <span className={`font-mono text-[12px] font-bold ${color}`}>{val}</span>
                            <span className="text-[7px] font-black uppercase tracking-[0.18em] text-gray-600">{lbl}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
