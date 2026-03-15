'use client';

import { useState, useMemo } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Calculator,
    Zap,
    ShieldAlert,
    Info,
} from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { CONTRACT_SIZES } from '@/lib/tradeCalculations';

/** Approximate pip value in USD per lot for each instrument group */
function getPipValue(symbol: string): number {
    const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cs = CONTRACT_SIZES[upper];
    if (!cs) return 10; // fallback
    if (upper.includes('JPY')) return (cs * 0.01) / 150; // approximate ¥/$ rate
    if (upper === 'XAUUSD') return cs * 0.01;             // gold: 1 pip = 0.01
    if (upper === 'XAGUSD') return cs * 0.001;            // silver: 1 pip = 0.001
    if (cs === 1000) return 1;                             // oil: 1 pip = $0.001 * 1000 = $1 approx
    if (cs === 1) return 1;                                // indices: 1 point = $1
    return cs * 0.0001;                                    // forex standard
}

const INSTRUMENTS = Object.keys(CONTRACT_SIZES);

export default function CalculatorPage() {
    const [balance, setBalance] = useState<number>(100000);
    const [riskPercent, setRiskPercent] = useState<number>(1);
    const [stopLossPips, setStopLossPips] = useState<number>(20);
    const [pair, setPair] = useState<string>('EURUSD');
    const { formatAmount, symbol } = useCurrency();

    const { lots, riskAmount, pipValue } = useMemo(() => {
        const riskVal = balance * (riskPercent / 100);
        const pv = getPipValue(pair);
        const calculatedLots = stopLossPips > 0 ? riskVal / (stopLossPips * pv) : 0;
        return {
            lots: Number(calculatedLots.toFixed(2)),
            riskAmount: riskVal,
            pipValue: pv,
        };
    }, [balance, riskPercent, stopLossPips, pair]);

    return (
        <DashboardShell>
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                        <Calculator size={14} /> Prism Financial Tools
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
                        Vector Size <span className="text-primary">Calculator</span>
                    </h1>
                    <p className="text-gray-500 font-bold max-w-lg mx-auto leading-relaxed">
                        Precision lot size computation based on account equity, risk tolerance, and technical invalidation points.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                    {/* Inputs */}
                    <div className="glass-card p-10 border-white/5 bg-white/5 space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Instrument Group</label>
                                <select
                                    value={pair}
                                    onChange={(e) => setPair(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-lg font-black text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                >
                                    {INSTRUMENTS.map(inst => (
                                        <option key={inst} value={inst}>{inst}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Account Balance ($)</label>
                                <input
                                    type="number"
                                    value={balance}
                                    onChange={(e) => setBalance(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Risk Percentage (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={riskPercent}
                                        onChange={(e) => setRiskPercent(Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Stop Loss (Pips)</label>
                                    <input
                                        type="number"
                                        value={stopLossPips}
                                        onChange={(e) => setStopLossPips(Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Results Display */}
                    <div className="flex flex-col gap-6">
                        <div className="flex-1 glass-card p-10 border-primary/20 bg-primary/5 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                            <Zap size={32} className="text-primary mb-6 animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60 mb-2">Recommended Position Size</p>
                            <h2 className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(0,242,255,0.4)]">
                                {lots} <span className="text-2xl text-primary/40">LOTS</span>
                            </h2>
                        </div>

                        <div className="glass-card p-10 border-white/5 bg-white/5 space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Capital At Risk</p>
                                    <h4 className="text-2xl font-black text-white">{formatAmount(riskAmount)}</h4>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20">
                                    <ShieldAlert size={20} />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/5 space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
                                    <span>Pip Value (Approx)</span>
                                    <span className="text-white">{symbol}{pipValue.toFixed(2)}/lot</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
                                    <span>Risk/Reward Ratio</span>
                                    <span className="text-primary">1:3.0 Target</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footnote */}
                <div className="flex items-start gap-4 p-8 glass-card border-white/5 bg-white/5 border-dashed">
                    <Info size={20} className="text-gray-700 shrink-0 mt-1" />
                    <p className="text-[10px] font-bold text-gray-600 leading-relaxed uppercase tracking-widest">
                        Notice: Calculations are based on standard contract sizes. For indices and crypto, contract specifications may vary by broker terminal. Always verify computed size against your Margin requirements before execution.
                    </p>
                </div>
            </div>
        </DashboardShell>
    );
}
