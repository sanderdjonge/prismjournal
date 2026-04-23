'use client';

import { usePrismScore } from '@/hooks/usePrismScore';
import { cn } from '@/lib/cn';
import { fmtDecimals } from '@/lib/formatNumber';

interface Props {
    accountId: string | null;
}

const COMPONENT_LABELS: Record<string, string> = {
    profitFactor:   'Profit Factor',
    winLossRatio:   'W/L Ratio',
    maxDrawdown:    'Drawdown',
    winRate:        'Win Rate',
    recoveryFactor: 'Recovery',
    consistency:    'Consistency',
};

const COMPONENT_ORDER = ['profitFactor', 'winLossRatio', 'maxDrawdown', 'winRate', 'recoveryFactor', 'consistency'];

function scoreColor(score: number): string {
    if (score >= 80) return 'var(--profit)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--loss)';
}

function scoreBg(score: number): string {
    if (score >= 80) return 'var(--profit-bg)';
    if (score >= 50) return 'var(--warning-bg)';
    return 'var(--loss-bg)';
}

function scoreLabel(score: number): string {
    if (score >= 80) return 'Elite';
    if (score >= 65) return 'Solid';
    if (score >= 50) return 'Developing';
    if (score >= 35) return 'Struggling';
    return 'Needs Work';
}

/** Compact circular gauge for horizontal layout */
function CompactScoreGauge({ score }: { score: number }) {
    const r = 40;
    const stroke = 7;
    const cx = 50;
    const cy = 50;
    const circumference = 2 * Math.PI * r;
    // Arc from 135° to 45° (270° arc, leaving 90° gap at bottom)
    const arcLength = circumference * 0.75;
    const progress = (score / 100) * arcLength;
    const color = scoreColor(score);

    return (
        <svg viewBox="0 0 100 100" width="80" height="80" className="shrink-0">
            <defs>
                <filter id="ps-glow-compact">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            {/* Track */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke="var(--border-color)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference}`}
                transform="rotate(135 50 50)"
            />
            {/* Progress */}
            {score > 0 && (
                <circle
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference}`}
                    transform="rotate(135 50 50)"
                    filter="url(#ps-glow-compact)"
                    style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
                />
            )}
            {/* Center score */}
            <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight={900} fontFamily="inherit">
                {fmtDecimals(score, 1)}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize={7} fontWeight={600} fontFamily="inherit">
                / 100
            </text>
        </svg>
    );
}

/** Trend bar chart at the bottom */
function TrendBarChart({ data }: { data: Array<{ score: number; week: string }> }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="mt-3 pt-3 border-t border-border-color">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">12-Week Trend</p>
            <div className="flex items-end gap-1 h-12">
                {data.map((entry, i) => {
                    const isLast = i === data.length - 1;
                    const height = Math.max(4, (entry.score / 100) * 100);
                    const color = scoreColor(entry.score);
                    
                    return (
                        <div
                            key={entry.week}
                            className="flex-1 rounded-sm transition-all hover:opacity-100 cursor-pointer group relative"
                            style={{
                                height: `${height}%`,
                                backgroundColor: color,
                                opacity: isLast ? 1 : 0.5,
                                boxShadow: isLast ? `0 0 6px ${color}60` : 'none',
                            }}
                            title={`${entry.week}: ${fmtDecimals(entry.score, 1)}`}
                        >
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10" style={{ backgroundColor: 'var(--surface-solid)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)' }}>
                                {entry.week}: {fmtDecimals(entry.score, 1)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function PrismScoreWidget({ accountId }: Props) {
    const { data, isLoading, isError } = usePrismScore(accountId);

    if (isLoading) {
        return (
            <div className="glass-card p-4 animate-pulse">
                <div className="h-4 w-28 rounded mb-3" style={{ backgroundColor: 'var(--surface-elevated)' }} />
                <div className="h-20 rounded" style={{ backgroundColor: 'var(--surface-elevated)' }} />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="glass-card p-4 flex items-center justify-center min-h-[120px]">
                <p className="text-gray-500 text-sm">Prism Score unavailable</p>
            </div>
        );
    }

    const { score, components, weeklyHistory } = data;
    const color = scoreColor(score);

    return (
        <div className="glass-card rounded-2xl p-4" style={{ background: scoreBg(score) }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">Prism Score</h3>
                    <p className="text-[10px] text-gray-500">Composite performance</p>
                </div>
                <div
                    className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border"
                    style={{ color, borderColor: color + '40', background: color + '10' }}
                >
                    {scoreLabel(score)}
                </div>
            </div>

            {/* Horizontal Layout: Gauge | Components */}
            <div className="flex items-stretch gap-3">
                {/* Compact circular gauge */}
                <div className="flex-shrink-0 flex items-center justify-center">
                    <CompactScoreGauge score={score} />
                </div>

                {/* Component bars - 2 column grid */}
                <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 content-center min-w-0">
                    {COMPONENT_ORDER.map((key) => {
                        const val = components[key as keyof typeof components] ?? 0;
                        const barColor = scoreColor(val);
                        return (
                            <div key={key} className="space-y-0.5 group relative">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-gray-500 cursor-help" title={COMPONENT_LABELS[key]}>
                                        {COMPONENT_LABELS[key]}
                                    </span>
                                    <span className="text-[9px] font-bold" style={{ color: barColor }}>{fmtDecimals(val, 1)}</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-elevated)' }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${val}%`, background: barColor }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Trend bar chart at bottom */}
            {weeklyHistory && weeklyHistory.length > 0 && (
                <TrendBarChart data={weeklyHistory} />
            )}
        </div>
    );
}
