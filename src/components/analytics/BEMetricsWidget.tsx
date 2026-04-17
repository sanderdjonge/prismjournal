'use client';

import { useBEMetrics } from '@/hooks/useBEMetrics';
import { ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { fmtDecimals } from '@/lib/formatNumber';

interface Props {
    accountId?: string | null;
}

function pct(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export default function BEMetricsWidget({ accountId }: Props) {
    const { data, isLoading, isError } = useBEMetrics(accountId);

    if (isLoading) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 animate-pulse">
                <div className="h-4 w-40 bg-white/5 rounded mb-4" />
                <div className="grid grid-cols-3 gap-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="h-16 bg-white/5 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (isError || !data || data.tradeCount === 0) {
        return (
            <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-100">SL Management & Breakeven</h3>
                        <p className="text-xs text-gray-500">No data yet</p>
                    </div>
                    <ShieldCheck size={14} className="text-gray-700" />
                </div>
                <div className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl p-4">
                    <ShieldCheck size={12} className="text-gray-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        Stats will appear once you have at least one closed trade with a stop loss set. This tracks breakeven moves, BE stop-outs, and R efficiency over time.
                    </p>
                </div>
            </div>
        );
    }

    const { beProtectionRate, beStopOutRate, avgRCaptured, avgRPotential, rEfficiency, tradeCount } = data;
    const showWarning = beStopOutRate > 0.3;

    // Color helpers
    const beRateColor = beProtectionRate >= 0.6 ? 'var(--profit)' : beProtectionRate >= 0.3 ? 'var(--warning)' : 'var(--loss)';
    const beStopColor = beStopOutRate > 0.5 ? 'var(--loss)' : beStopOutRate > 0.3 ? 'var(--warning)' : 'var(--profit)';
    const effColor = rEfficiency >= 0.7 ? 'var(--profit)' : rEfficiency >= 0.4 ? 'var(--warning)' : 'var(--loss)';

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">SL Management & Breakeven</h3>
                    <p className="text-xs text-gray-500">{tradeCount} trades with initial SL data</p>
                </div>
                <ShieldCheck size={14} className="text-gray-700" />
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* BE Protection Rate */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">BE Protection Rate</p>
                    <p className="text-2xl font-black tracking-tighter" style={{ color: beRateColor }}>
                        {pct(beProtectionRate)}
                    </p>
                    <p className="text-[8px] text-gray-600 font-medium leading-tight">moved SL to breakeven</p>
                </div>

                {/* BE Stop-Out Rate */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">BE Stop-Out Rate</p>
                    <p className="text-2xl font-black tracking-tighter" style={{ color: beStopColor }}>
                        {pct(beStopOutRate)}
                    </p>
                    <p className="text-[8px] text-gray-600 font-medium leading-tight">BE trades closed at loss</p>
                </div>

                {/* R stats */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Avg R Captured</p>
                    <p className="text-2xl font-black tracking-tighter" style={{ color: effColor }}>
                        {fmtDecimals(avgRCaptured, 2)}R
                    </p>
                    {avgRPotential > 0 && (
                        <p className="text-[8px] text-gray-600 font-medium leading-tight">
                            vs {fmtDecimals(avgRPotential, 2)}R potential
                        </p>
                    )}
                </div>
            </div>

            {/* R Efficiency progress bar */}
            {avgRPotential > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                            <TrendingUp size={10} />
                            R Efficiency
                        </span>
                        <span className="text-[10px] font-black" style={{ color: effColor }}>
                            {pct(rEfficiency)}
                        </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(rEfficiency * 100, 100)}%`, background: effColor }}
                        />
                    </div>
                    <p className="text-[8px] text-gray-600 font-medium">
                        {fmtDecimals(avgRCaptured, 2)}R captured out of {fmtDecimals(avgRPotential, 2)}R average potential
                    </p>
                </div>
            )}

            {/* Warning callout */}
            {showWarning && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                    <AlertTriangle size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-yellow-300 font-bold leading-relaxed">
                        Warning: {pct(beStopOutRate)} of your BE-protected trades were stopped at entry. Consider holding longer before moving SL to breakeven.
                    </p>
                </div>
            )}
        </div>
    );
}
