'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { QuadrantTrade } from '@/hooks/useExcursionTrades';
import type { JournalTrade } from '@/app/journal/page';
import TradeViewModal from '@/components/journal/TradeViewModal';

// ---------------------------------------------------------------------------
// Pure calculation helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/** Exit efficiency %: where along the MAE→MFE range did the trade exit?
 *  0% = exited at max adverse point, 100% = exited at max favorable point. */
export function calcExitEfficiency(
    mae: number | null,
    mfe: number | null,
    exitDistFromEntry: number | null,
): number | null {
    if (mae == null || mfe == null || exitDistFromEntry == null) return null;
    const totalRange = mae + mfe;
    if (totalRange === 0) return null;
    const raw = ((mae + exitDistFromEntry) / totalRange) * 100;
    return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
}

export type ZoneKey = 'clean' | 'earlyOut' | 'survived' | 'painful';

/** Assign a trade to one of four quadrant zones. */
export function assignZone(mae: number, efficiency: number, medianMae: number): ZoneKey {
    const highMae = mae > medianMae;
    const highEff = efficiency >= 50;
    if (!highMae && highEff) return 'clean';
    if (!highMae && !highEff) return 'earlyOut';
    if (highMae && highEff) return 'survived';
    return 'painful';
}

// ---------------------------------------------------------------------------
// Zone configuration
// ---------------------------------------------------------------------------

const ZONE_CONFIG: Record<ZoneKey, {
    label: string;
    desc: string;
    color: string;
    bgFill: string;
    textColor: string;
}> = {
    clean:    { label: 'Clean',     desc: 'Good entry + good exit',         color: '#4ade80', bgFill: 'rgba(74,222,128,0.06)',   textColor: 'text-green-400' },
    earlyOut: { label: 'Early Out', desc: 'Good entry, left profit behind',  color: '#facc15', bgFill: 'rgba(250,204,21,0.05)',   textColor: 'text-yellow-400' },
    survived: { label: 'Survived',  desc: 'Rough entry, recovered well',     color: '#fb923c', bgFill: 'rgba(251,146,60,0.06)',   textColor: 'text-orange-400' },
    painful:  { label: 'Painful',   desc: 'Rough entry + poor exit',         color: '#f87171', bgFill: 'rgba(248,113,113,0.07)', textColor: 'text-red-400' },
};

// ---------------------------------------------------------------------------
// Chart layout constants
// ---------------------------------------------------------------------------

const ML = 64;   // margin left
const MR = 32;   // margin right
const MT = 44;   // margin top
const MB = 52;   // margin bottom
const VW = 800;  // SVG viewBox width
const VH = 420;  // SVG viewBox height
const CW = VW - ML - MR;
const CH = VH - MT - MB;

// ---------------------------------------------------------------------------
// Tooltip row helper
// ---------------------------------------------------------------------------
function Row({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex items-center justify-between gap-4 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</span>
            <span className={`text-[11px] font-bold ${color}`}>{value}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ExcursionQuadrantPlotProps {
    trades: QuadrantTrade[];
}

export function ExcursionQuadrantPlot({ trades }: ExcursionQuadrantPlotProps) {
    const router = useRouter();
    const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Only include trades with both MAE and MFE and a computable efficiency
    const plotTrades = useMemo(() => trades.filter(t =>
        t.mae != null && t.mae > 0 &&
        t.mfe != null && t.mfe > 0 &&
        t.exitDistFromEntry != null
    ), [trades]);

    if (plotTrades.length < 2) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                    Exit Quality Analysis
                </h3>
                <div className="flex items-center justify-center h-48 text-gray-700 text-[10px] font-black uppercase tracking-widest text-center px-8">
                    Sync trades with the updated EA to populate this chart —<br />
                    MAE / MFE data needed for at least 2 closed trades
                </div>
            </div>
        );
    }

    // Derived axis values
    const maxMae = Math.max(...plotTrades.map(t => t.mae!)) * 1.15;
    const sortedMae = [...plotTrades.map(t => t.mae!)].sort((a, b) => a - b);
    const medianMae = sortedMae[Math.floor(sortedMae.length / 2)];

    const scaleX = (mae: number) => ML + (mae / maxMae) * CW;
    const scaleY = (eff: number) => MT + CH - (eff / 100) * CH;
    const midX = scaleX(medianMae);
    const midY = scaleY(50);

    // Enrich trades with zone + efficiency
    type PlotTrade = QuadrantTrade & { eff: number; zone: ZoneKey };
    const enriched: PlotTrade[] = plotTrades.map(t => {
        const eff = calcExitEfficiency(t.mae!, t.mfe!, t.exitDistFromEntry!)!;
        const zone = assignZone(t.mae!, eff, medianMae);
        return { ...t, eff, zone };
    });

    // Zone counts for summary badges
    const zoneCounts = enriched.reduce<Record<ZoneKey, number>>(
        (acc, t) => { acc[t.zone]++; return acc; },
        { clean: 0, earlyOut: 0, survived: 0, painful: 0 },
    );

    const hovered = enriched.find(t => t.id === hoveredId);

    return (
        <>
            {/* Trade view modal — opened on dot click */}
            <TradeViewModal
                trade={selectedTrade}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setSelectedTrade(null); }}
                onEdit={() => { setModalOpen(false); router.push('/journal'); }}
            />

            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
                            Exit Quality Analysis
                        </h3>
                        <p className="text-[8px] text-gray-600 font-bold mt-1">
                            Entry risk (X) × Exit efficiency (Y) — click any dot to view trade
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                            <span className="text-gray-500">Profitable</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            <span className="text-gray-500">Loss</span>
                        </span>
                    </div>
                </div>

                {/* Chart */}
                <div className="relative">
                    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: 380 }}>
                        {/* Zone backgrounds */}
                        <rect x={ML} y={MT} width={midX - ML} height={midY - MT} fill="rgba(251,146,60,0.06)" />
                        <rect x={midX} y={MT} width={ML + CW - midX} height={midY - MT} fill="rgba(74,222,128,0.06)" />
                        <rect x={ML} y={midY} width={midX - ML} height={MT + CH - midY} fill="rgba(248,113,113,0.06)" />
                        <rect x={midX} y={midY} width={ML + CW - midX} height={MT + CH - midY} fill="rgba(250,204,21,0.045)" />

                        {/* Zone labels */}
                        {([ ['SURVIVED', ML + 8, MT + 16, 'rgba(251,146,60,0.6)', 'rough entry, made it work'],
                            ['CLEAN',    midX + 8, MT + 16, 'rgba(74,222,128,0.6)', 'clean entry, good exit'],
                            ['PAINFUL',  ML + 8, MT + CH - 6, 'rgba(248,113,113,0.6)', 'rough entry + poor exit'],
                            ['EARLY OUT',midX + 8, MT + CH - 6, 'rgba(250,204,21,0.6)', 'left profit on the table'],
                        ] as const).map(([name, x, y, color, sub]) => (
                            <g key={name}>
                                <text x={x} y={y} fill={color} fontSize={10} fontWeight={900} fontFamily="sans-serif" letterSpacing={1.5}>{name}</text>
                                <text x={x} y={y + 13} fill="rgba(255,255,255,0.12)" fontSize={8} fontFamily="sans-serif">{sub}</text>
                            </g>
                        ))}

                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map(v => (
                            <g key={v}>
                                <line x1={ML} y1={scaleY(v)} x2={ML + CW} y2={scaleY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />
                                <text x={ML - 6} y={scaleY(v) + 4} fill="#4b5563" fontSize={8} textAnchor="end" fontFamily="sans-serif" fontWeight={700}>{v}%</text>
                            </g>
                        ))}

                        {/* Divider lines */}
                        <line x1={midX} y1={MT} x2={midX} y2={MT + CH} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />
                        <line x1={ML} y1={midY} x2={ML + CW} y2={midY} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />

                        {/* X axis */}
                        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                        {[0, 1, 2, 3, 4].map(i => {
                            const v = (maxMae / 4) * i;
                            const x = scaleX(v);
                            return <text key={i} x={x} y={MT + CH + 16} fill="#4b5563" fontSize={8} textAnchor="middle" fontFamily="sans-serif" fontWeight={700}>{v.toFixed(1)}</text>;
                        })}

                        {/* Axis labels */}
                        <text x={ML + CW / 2} y={VH - 4} fill="#6b7280" fontSize={9} textAnchor="middle" fontFamily="sans-serif" fontWeight={900} letterSpacing={1.5}>MAX ADVERSE EXCURSION (pts) →</text>
                        <text x={12} y={MT + CH / 2} fill="#6b7280" fontSize={9} textAnchor="middle" fontFamily="sans-serif" fontWeight={900} letterSpacing={1.5} transform={`rotate(-90, 12, ${MT + CH / 2})`}>↑ EXIT EFFICIENCY %</text>

                        {/* Dots */}
                        {enriched.map(t => {
                            const cx = scaleX(t.mae!);
                            const cy = scaleY(t.eff);
                            const isWin = t.pnl >= 0;
                            const isHovered = t.id === hoveredId;
                            return (
                                <circle
                                    key={t.id}
                                    cx={cx} cy={cy}
                                    r={isHovered ? 10 : 7}
                                    fill={isWin ? '#4ade80' : '#f87171'}
                                    fillOpacity={isHovered ? 1 : 0.8}
                                    stroke={isWin ? '#86efac' : '#fca5a5'}
                                    strokeWidth={1.5}
                                    style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                                    onMouseEnter={() => setHoveredId(t.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    onClick={() => { setSelectedTrade(t); setModalOpen(true); }}
                                    role="button"
                                    aria-label={`${t.symbol} — ${t.zone} zone. Click to view trade.`}
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelectedTrade(t); setModalOpen(true); } }}
                                />
                            );
                        })}
                    </svg>

                    {/* Hover tooltip */}
                    {hovered && (() => {
                        const cx = scaleX(hovered.mae!) / VW * 100;
                        const cy = scaleY(hovered.eff) / VH * 100;
                        const flipX = cx > 55;
                        const flipY = cy > 55;
                        const zone = ZONE_CONFIG[hovered.zone];
                        const isWin = hovered.pnl >= 0;
                        const pnlSign = isWin ? '+' : '';
                        const slVal = hovered.stopLoss;
                        const slMsg = slVal != null && hovered.mae != null
                            ? hovered.mae > slVal
                                ? `Price went ${(hovered.mae - slVal).toFixed(4)} past your stop`
                                : 'Stop never threatened'
                            : null;
                        const exitDate = hovered.exitTime
                            ? new Date(hovered.exitTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                            : null;

                        return (
                            <div
                                className="absolute pointer-events-none z-10 bg-[#0d0d1a] border border-white/10 rounded-xl p-3.5 min-w-[220px] shadow-2xl"
                                style={{
                                    ...(flipX ? { right: `${100 - cx}%` } : { left: `calc(${cx}% + 14px)` }),
                                    ...(flipY ? { bottom: `${100 - cy}%` } : { top: `calc(${cy}% - 8px)` }),
                                }}
                            >
                                <p className="text-xs font-black text-white uppercase tracking-wide mb-0.5">{hovered.symbol}</p>
                                {exitDate && <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2.5">{exitDate}</p>}
                                <Row label="Captured" value={`${hovered.exitDistFromEntry != null && hovered.exitDistFromEntry >= 0 ? '+' : ''}${hovered.exitDistFromEntry?.toFixed(4) ?? '—'} pts`} color={isWin ? 'text-green-400' : 'text-red-400'} />
                                <Row label="Best available (MFE)" value={`+${hovered.mfe?.toFixed(4) ?? '—'} pts`} />
                                {hovered.mfe != null && hovered.exitDistFromEntry != null && (
                                    <Row label="Left on table" value={`${(hovered.mfe - hovered.exitDistFromEntry).toFixed(4)} pts`} color="text-yellow-400" />
                                )}
                                <div className="my-2 h-px bg-white/5" />
                                <Row label="Max against you (MAE)" value={`-${hovered.mae?.toFixed(4) ?? '—'} pts`} color="text-red-400" />
                                {slMsg && <Row label="Your stop" value={slMsg} />}
                                <Row label="Exit efficiency" value={`${hovered.eff.toFixed(1)}%`} />
                                <Row label="P&L" value={`${pnlSign}${hovered.pnl.toFixed(2)}`} color={isWin ? 'text-green-400' : 'text-red-400'} />
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest" style={{ background: zone.color + '22', color: zone.color, border: `1px solid ${zone.color}44` }}>
                                    {zone.label}
                                </div>
                                <p className="text-[10px] text-white/30 italic mt-1.5">{zone.desc}</p>
                                <p className="text-[8px] text-white/20 mt-2 uppercase tracking-widest">Click to view trade →</p>
                            </div>
                        );
                    })()}
                </div>

                {/* Zone summary badges */}
                <div className="grid grid-cols-4 gap-2.5 mt-5">
                    {(Object.entries(ZONE_CONFIG) as [ZoneKey, typeof ZONE_CONFIG[ZoneKey]][]).map(([key, z]) => (
                        <div
                            key={key}
                            className="rounded-xl p-3 border"
                            style={{ background: z.bgFill, borderColor: z.color + '33' }}
                        >
                            <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: z.color }}>{z.label}</p>
                            <p className="text-xl font-black" style={{ color: z.color }}>{zoneCounts[key]}</p>
                            <p className="text-[9px] text-white/30 font-medium mt-0.5 leading-tight">{z.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
