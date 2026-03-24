'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
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

const COMPONENT_ORDER = ['profitFactor', 'winLossRatio', 'maxDrawdown', 'winRate', 'recoveryFactor', 'consistency'];
const COMPONENT_WEIGHTS: Record<string, number> = {
    profitFactor: 25, winLossRatio: 20, maxDrawdown: 20,
    winRate: 15, recoveryFactor: 10, consistency: 10,
};

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

/** SVG arc gauge */
function ScoreGauge({ score }: { score: number }) {
    const r = 80;
    const stroke = 14;
    const cx = 110;
    const cy = 100;
    const startAngle = 210;
    const totalArc = 300;

    const polar = (angle: number) => {
        const rad = (angle - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const start = polar(startAngle);
    const bgEnd  = polar(startAngle + totalArc);

    const pct = Math.min(Math.max(score / 100, 0), 1);
    const progressAngle = startAngle + totalArc * pct;
    const progressEnd = polar(progressAngle);
    const largeArc = totalArc * pct > 180 ? 1 : 0;

    const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;
    const fgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${progressEnd.x} ${progressEnd.y}`;

    const color = scoreColor(score);

    return (
        <svg viewBox="0 0 220 195" className="w-full max-w-[220px]">
            <defs>
                <filter id="ps-glow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            {/* Track */}
            <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} strokeLinecap="round" />
            {/* Progress */}
            {score > 0 && (
                <path
                    d={fgPath} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    filter="url(#ps-glow)"
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
            )}
            {/* Center score */}
            <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={42} fontWeight={900} fontFamily="inherit">
                {score}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={10} fontWeight={700} fontFamily="inherit" letterSpacing={3}>
                / 100
            </text>
            <text x={cx} y={cy + 33} textAnchor="middle" fill={color} fontSize={11} fontWeight={800} fontFamily="inherit" letterSpacing={2}>
                {scoreLabel(score).toUpperCase()}
            </text>
        </svg>
    );
}

export default function PrismScoreWidget({ accountId }: Props) {
    const { data, isLoading, isError } = usePrismScore(accountId);

    if (isLoading) {
        return (
            <div className="glass-card p-6 animate-pulse">
                <div className="h-4 w-32 bg-white/5 rounded mb-4" />
                <div className="h-40 bg-white/5 rounded" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
                <p className="text-gray-500 text-sm">Prism Score unavailable</p>
            </div>
        );
    }

    const { score, components, weeklyHistory } = data;
    const color = scoreColor(score);

    // Format weekly history for the chart — show last 8 weeks label only on alternating weeks to avoid crowding
    const chartData = weeklyHistory.map((w, i) => ({
        ...w,
        displayWeek: i % 2 === 0 ? w.week.replace(/^\d{4}-/, '') : '',
    }));

    return (
        <div className="glass-card p-5 space-y-5" style={{ background: scoreBg(score) }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">Prism Score</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">Composite performance quality</p>
                </div>
                <div
                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border"
                    style={{ color, borderColor: color + '40', background: color + '10' }}
                >
                    {scoreLabel(score)}
                </div>
            </div>

            {/* Gauge + Components */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Gauge */}
                <div className="flex-shrink-0 flex items-center justify-center w-full sm:w-auto">
                    <ScoreGauge score={score} />
                </div>

                {/* Component breakdown */}
                <div className="flex-1 w-full space-y-2 min-w-0">
                    {COMPONENT_ORDER.map((key) => {
                        const val = components[key as keyof typeof components] ?? 0;
                        const weight = COMPONENT_WEIGHTS[key];
                        const barColor = scoreColor(val);
                        return (
                            <div key={key} className="space-y-0.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-medium">{COMPONENT_LABELS[key]}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-600">{weight}%</span>
                                        <span className="text-[10px] font-black" style={{ color: barColor }}>{val}</span>
                                    </div>
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
            </div>

            {/* Weekly trend */}
            {chartData.length > 0 && (
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 mb-2">12-Week Trend</p>
                    <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={10}>
                                <XAxis
                                    dataKey="displayWeek"
                                    tick={{ fill: '#4b5563', fontSize: 8 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis domain={[0, 100]} hide />
                                <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                    contentStyle={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                                    formatter={(v) => [v, 'Score']}
                                    labelFormatter={(_l, payload) => (payload as Array<{ payload?: { week?: string } }>)?.[0]?.payload?.week ?? ''}
                                />
                                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={scoreColor(entry.score)} fillOpacity={0.7} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
