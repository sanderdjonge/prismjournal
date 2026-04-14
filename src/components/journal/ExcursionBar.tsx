'use client';

import { formatPercent } from '@/lib/formatNumber';

/**
 * ExcursionBar — proportional horizontal bar visualising MAE / exit point / MFE.
 *
 * Bar layout (left → right):
 *   [  MAE zone (red)  |  entry marker  |  exit marker  |  MFE zone (green)  ]
 *
 * The total bar width represents the full price range from MAE to MFE.
 * Entry is always at 0 (the baseline dividing adverse from favorable).
 * Exit efficiency = (exit_pnl - (-mae)) / (mfe - (-mae)) * 100
 *                 = (mae + exitPnlAsDistance) / (mae + mfe) * 100
 *
 * Props:
 *   mae      — max adverse excursion as positive price distance from entry
 *   mfe      — max favorable excursion as positive price distance from entry
 *   pnl      — actual closed P&L (used only to derive exit-as-fraction when
 *               exitPriceDist is not available)
 *   exitPriceDist — actual exit price distance from entry (same sign convention as
 *                   pnl direction). If omitted, component falls back to pnl-based
 *                   efficiency (less accurate across lot sizes / pip values).
 *   pipLabel  — optional: label for axis unit, e.g. "pips" or "pts". Defaults to "pts".
 */

export interface ExcursionBarProps {
    mae?: number | null;
    mfe?: number | null;
    /**
     * Signed exit distance from entry in the same unit as mae/mfe.
     * Positive = favorable direction, negative = adverse direction.
     */
    exitDistFromEntry?: number | null;
    pipLabel?: string;
}

function round2(v: number) {
    return Math.round(v * 100) / 100;
}

export function ExcursionBar({ mae, mfe, exitDistFromEntry, pipLabel = 'pts' }: ExcursionBarProps) {
    // Require MFE to be present and > 0 (MAE can be null, treat as 0)
    if (!mfe || mfe <= 0) {
        return (
            <div className="space-y-1.5">
                <div className="h-4 rounded-full bg-white/5 w-full" />
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">
                    MAE / MFE data not yet available — sync a new trade or run backfill
                </p>
            </div>
        );
    }

    // Treat NULL MAE as 0 (assume no adverse excursion)
    const effectiveMae = mae ?? 0;

    const totalRange = effectiveMae + mfe; // full bar = MAE + MFE distance
    const maePercent = (effectiveMae / totalRange) * 100;
    const mfePercent = (mfe / totalRange) * 100;

    // Entry marker sits exactly at the MAE/MFE boundary (maePercent from left)
    const entryLeftPercent = maePercent;

    // Exit marker position: if exitDistFromEntry is provided, map it to bar position.
    // exitDistFromEntry > 0 means exit was in favorable territory, < 0 in adverse territory.
    // Bar position of exit = (mae + exitDistFromEntry) / totalRange * 100
    let exitLeftPercent: number | null = null;
    let exitEfficiency: number | null = null;

    if (exitDistFromEntry != null) {
        const rawPos = (effectiveMae + exitDistFromEntry) / totalRange;
        exitLeftPercent = Math.min(100, Math.max(0, rawPos * 100));
        // Efficiency: 0% = exited at MAE point, 100% = exited at MFE point
        exitEfficiency = round2(rawPos * 100);
    }

    return (
        <div className="space-y-2 w-full">
            {/* Bar */}
            <div className="relative h-4 rounded-full overflow-hidden flex">
                {/* MAE zone — red */}
                <div
                    className="h-full bg-red-500/40"
                    style={{ width: `${maePercent}%` }}
                />
                {/* MFE zone — green */}
                <div
                    className="h-full bg-green-500/40"
                    style={{ width: `${mfePercent}%` }}
                />

                {/* Entry marker — thin white vertical line */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10"
                    style={{ left: `${entryLeftPercent}%` }}
                />

                {/* Exit marker — accent dot */}
                {exitLeftPercent != null && (
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 border border-amber-200/60 z-20 -translate-x-1/2"
                        style={{ left: `${exitLeftPercent}%` }}
                    />
                )}
            </div>

            {/* Labels row */}
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                <span className="text-red-400/80">
                    MAE: -{round2(effectiveMae)} {pipLabel}
                </span>
                {exitEfficiency != null && (
                    <span className={
                        exitEfficiency >= 66
                            ? 'text-green-400'
                            : exitEfficiency >= 33
                                ? 'text-amber-400'
                                : 'text-red-400'
                    }>
                        Exit: {formatPercent(exitEfficiency, 1)}
                    </span>
                )}
                <span className="text-green-400/80">
                    MFE: +{round2(mfe)} {pipLabel}
                </span>
            </div>
        </div>
    );
}
