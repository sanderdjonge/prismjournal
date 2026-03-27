'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUpdateTrade } from '@/hooks/useTrades';
import { ExcursionBar } from '@/components/journal/ExcursionBar';
import { computeDuration, deriveListZone } from './TradeListPanel';
import { MOOD_OPTIONS, COMPLIANCE_OPTIONS } from '@/constants/tradeConfig';
import type { JournalTrade } from '@/app/journal/page';

interface TradeDetailPanelProps {
    trade: JournalTrade;
}

function Stars({
    value,
    onChange,
}: {
    value: number | null | undefined;
    onChange: (n: number) => void;
}) {
    const [hovered, setHovered] = useState<number | null>(null);
    const active = hovered ?? value ?? 0;
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(null)}
                    className={`text-[14px] leading-none transition-colors ${
                        n <= active ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'
                    }`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 mb-1">{label}</div>
            {children}
        </div>
    );
}

export function TradeDetailPanel({ trade }: TradeDetailPanelProps) {
    const update = useUpdateTrade();

    const [notes, setNotes] = useState(trade.notes ?? '');
    const [mood, setMood] = useState(trade.mood ?? '');
    const [compliance, setCompliance] = useState(trade.planCompliance ?? '');

    // Reset local editable state when the selected trade changes
    useEffect(() => {
        setNotes(trade.notes ?? '');
        setMood(trade.mood ?? '');
        setCompliance(trade.planCompliance ?? '');
    }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRating = (field: 'entryRating' | 'exitRating' | 'managementRating', val: number) => {
        update.mutate(
            { id: trade.id, body: { [field]: val } },
            { onError: () => toast.error('Failed to save rating') },
        );
    };

    const handleSave = () => {
        update.mutate(
            { id: trade.id, body: { notes: notes || null, mood: mood || null, planCompliance: compliance || null } },
            {
                onSuccess: () => toast.success('Saved'),
                onError: () => toast.error('Save failed'),
            },
        );
    };

    const isForex = /USD|EUR|GBP|JPY|CHF|AUD|CAD|NZD/i.test(trade.symbol);
    const fmt = (v: number) => isForex ? v.toFixed(5) : v.toFixed(0);

    const duration = computeDuration(trade.entryTime, trade.exitTime);
    const zone = deriveListZone(trade);

    const exitDist = trade.exit && trade.exit > 0 && trade.mae && trade.mfe
        ? (trade.type === 'LONG' ? trade.exit - trade.entry : trade.entry - trade.exit)
        : null;

    const entryDateStr = trade.entryTime
        ? new Date(trade.entryTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            + ' · '
            + new Date(trade.entryTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';

    const exitDateStr = trade.exitTime
        ? new Date(trade.exitTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            + ' · '
            + new Date(trade.exitTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';

    return (
        <div
            className="flex flex-col min-h-0 border-l border-white/[0.06] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
            style={{ width: 340 }}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-500">Trade Details</span>
                {zone && (
                    <span className={`text-[8px] font-black uppercase tracking-[0.12em] px-2 py-[2px] rounded ${
                        zone === 'Clean' ? 'bg-profit/10 text-profit' :
                        zone === 'Painful' ? 'bg-loss/10 text-loss' :
                        zone === 'EarlyOut' ? 'bg-yellow-400/10 text-yellow-400' :
                        'bg-orange-400/10 text-orange-400'
                    }`}>{zone}</span>
                )}
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4 min-h-0">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="font-mono text-[26px] font-black italic text-white tracking-tight leading-none">{trade.symbol}</div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[9px] font-black uppercase tracking-[0.08em] px-[5px] py-[1px] rounded-[3px] ${
                                trade.type === 'LONG' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                            }`}>{trade.type}</span>
                            <span className="text-[9px] font-semibold text-gray-600">{trade.volume.toFixed(2)} lots</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`font-mono text-[20px] font-bold leading-none ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)}
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-600 mt-1">
                            {trade.pnl >= 0 ? 'profit' : 'loss'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-[6px]">
                    <Cell label="Entry">
                        <span className="font-mono text-[13px] font-semibold text-primary">{fmt(trade.entry)}</span>
                    </Cell>
                    <Cell label="Exit">
                        <span className="font-mono text-[13px] font-semibold text-white">{trade.exit && trade.exit > 0 ? fmt(trade.exit) : '—'}</span>
                    </Cell>
                    <Cell label="Entry Time">
                        <span className="text-[11px] font-semibold text-gray-300">{entryDateStr}</span>
                    </Cell>
                    <Cell label="Exit Time">
                        <span className="text-[11px] font-semibold text-gray-300">{exitDateStr}</span>
                    </Cell>
                    <Cell label="Duration">
                        <span className="text-[11px] font-semibold text-gray-300">{duration ?? '—'}</span>
                    </Cell>
                    <Cell label="Volume">
                        <span className="text-[11px] font-semibold text-gray-300">{trade.volume.toFixed(2)}</span>
                    </Cell>
                </div>

                {trade.mae && trade.mfe && (
                    <div className="space-y-1">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Excursion</div>
                        <ExcursionBar
                            mae={trade.mae}
                            mfe={trade.mfe}
                            exitDistFromEntry={exitDist ?? undefined}
                            pipLabel={isForex ? 'pips' : 'pts'}
                        />
                    </div>
                )}

                <div className="space-y-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Ratings</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Entry', field: 'entryRating' as const, value: trade.entryRating },
                            { label: 'Exit', field: 'exitRating' as const, value: trade.exitRating },
                            { label: 'Mgmt', field: 'managementRating' as const, value: trade.managementRating },
                        ].map(({ label, field, value }) => (
                            <div key={field} className="flex flex-col items-center gap-1">
                                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-600">{label}</span>
                                <Stars value={value} onChange={n => handleRating(field, n)} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Mood</div>
                    <div className="flex flex-wrap gap-1">
                        {MOOD_OPTIONS.map(m => {
                            const Icon = m.icon;
                            const isActive = mood === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMood(isActive ? '' : m.id)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-[0.08em] transition-all ${
                                        isActive
                                            ? `${m.bg} ${m.color} border-current`
                                            : 'bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06]'
                                    }`}
                                >
                                    <Icon size={12} />
                                    {m.id}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Plan Compliance</div>
                    <div className="flex gap-1">
                        {COMPLIANCE_OPTIONS.map(c => {
                            const isActive = compliance === c.id;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setCompliance(isActive ? '' : c.id)}
                                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.08em] transition-all ${
                                        isActive
                                            ? `${c.activeBg} ${c.color} ${c.activeBorder}`
                                            : 'bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06]'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {trade.tags && trade.tags.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Tags</div>
                        <div className="flex flex-wrap gap-1">
                            {trade.tags.map(tag => (
                                <span
                                    key={tag.id}
                                    className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-[0.08em] bg-white/[0.05] border border-white/[0.08]"
                                    style={{ color: tag.color || '#00f2ff' }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Notes</div>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add notes about this trade..."
                        className="flex-1 min-h-[80px] bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-primary/40 transition-colors"
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={update.isPending}
                    className="w-full h-10 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {update.isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
