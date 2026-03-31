'use client';

import { usePrismScore } from '@/hooks/usePrismScore';
import { cn } from '@/lib/cn';

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

// Short labels for compact view
const COMPONENT_SHORT_LABELS: Record<string, string> = {
    profitFactor:   'PF',
    winLossRatio:   'W/L',
    maxDrawdown:    'DD',
    winRate:        'WR',
    recoveryFactor: 'Rec',
    consistency:    'Con',
};

const COMPONENT_ORDER = ['profitFactor', 'winLossRatio', 'maxDrawdown', 'winRate', 'recoveryFactor', 'consistency'];

function scoreColor(score: number): string {
    if (score >= 80) return '#4ade80'; // green
    if (score >= 50) return '#facc15'; // yellow
    return '#f87171';                  // red
}

function scoreBg(score: number): string {
    if (score >= 80) return 'rgba(74,222,128,0.08)';
    if (score >= 50) return 'rgba(250,204,21,0.08)';
    return 'rgba(248,113,113,0.08)';
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
                stroke="rgba(255,255,255,0.08)"
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
                {score}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={7} fontWeight={600} fontFamily="inherit">
                / 100
            </text>
        </svg>
    );
}

/** Sparkline trend using pure CSS */
function TrendSparkline({ data }: { data: Array<{ score: number; week: string }> }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[7px] font-black uppercase tracking-widest text-white/20 mb-1">TREND</p>
            <div className="flex items-end gap-0.5 h-14 w-full">
                {data.map((entry, i) => {
                    const isLast = i === data.length - 1;
                    const height = Math.max(8, (entry.score / 100) * 100);
                    const color = scoreColor(entry.score);
                    
                    return (
                        <div
                            key={entry.week}
                            className="flex-1 rounded-sm transition-all hover:opacity-100"
                            style={{
                                height: `${height}%`,
                                backgroundColor: color,
                                opacity: isLast ? 0.8 : 0.6,
                                boxShadow: isLast ? `0 0 4px ${color}40` : 'none',
                            }}
                            title={`${entry.week}: ${entry.score}`}
                        />
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
                <div className="h-4 w-28 bg-white/5 rounded mb-3" />
                <div className="h-20 bg-white/5 rounded" />
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

            {/* Horizontal Layout: Gauge | Components | Sparkline */}
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
                            <div key={key} className="space-y-0.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-gray-500">{COMPONENT_SHORT_LABELS[key]}</span>
                                    <span className="text-[9px] font-bold" style={{ color: barColor }}>{val}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${val}%`, background: barColor }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Trend sparkline */}
                {weeklyHistory && weeklyHistory.length > 0 && (
                    <div className="flex-shrink-0 w-12 flex items-stretch">
                        <TrendSparkline data={weeklyHistory} />
                    </div>
                )}
            </div>
        </div>
    );
}
