'use client';

import { useState, useMemo } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import {
    Calculator,
    Zap,
    ShieldAlert,
    Info,
    ArrowRightLeft,
} from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { CONTRACT_SIZES } from '@/lib/tradeCalculations';
import { fmtDecimals } from '@/lib/formatNumber';

function getPipValue(symbol: string): number {
    const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cs = CONTRACT_SIZES[upper];
    if (!cs) return 10;
    if (upper.includes('JPY')) return (cs * 0.01) / 150;
    if (upper === 'XAUUSD') return cs * 0.01;
    if (upper === 'XAGUSD') return cs * 0.001;
    if (cs === 1000) return 1;
    if (cs === 1) return 1;
    return cs * 0.0001;
}

function getPipSize(symbol: string): number {
    const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (upper.includes('JPY')) return 0.01;
    if (upper === 'XAUUSD') return 0.1;
    if (upper === 'XAGUSD') return 0.01;
    if (CONTRACT_SIZES[upper] === 1) return 1;
    if (CONTRACT_SIZES[upper] === 1000) return 0.01;
    return 0.0001;
}

const INSTRUMENTS = Object.keys(CONTRACT_SIZES);

type InputMode = 'pips' | 'price';

export default function CalculatorPage() {
    const [balance, setBalance] = useState<number>(100000);
    const [riskPercent, setRiskPercent] = useState<number>(1);
    const [stopLossPips, setStopLossPips] = useState<number>(20);
    const [pair, setPair] = useState<string>('EURUSD');
    const [inputMode, setInputMode] = useState<InputMode>('pips');
    const [entryPrice, setEntryPrice] = useState<number>(0);
    const [slPrice, setSlPrice] = useState<number>(0);
    const { formatAmount, symbol } = useCurrency();

    const effectivePips = useMemo(() => {
        if (inputMode === 'pips') return stopLossPips;
        if (entryPrice > 0 && slPrice > 0) {
            const pipSize = getPipSize(pair);
            const distance = Math.abs(entryPrice - slPrice);
            return distance / pipSize;
        }
        return 0;
    }, [inputMode, stopLossPips, entryPrice, slPrice, pair]);

    const { lots, riskAmount, pipValue } = useMemo(() => {
        const riskVal = balance * (riskPercent / 100);
        const pv = getPipValue(pair);
        const calculatedLots = effectivePips > 0 ? riskVal / (effectivePips * pv) : 0;
        return {
            lots: Number(calculatedLots.toFixed(2)),
            riskAmount: riskVal,
            pipValue: pv,
        };
    }, [balance, riskPercent, effectivePips, pair]);

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
                    <p className="text-text-muted font-bold max-w-lg mx-auto leading-relaxed">
                        Precision lot size computation based on account equity, risk tolerance, and technical invalidation points.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                    {/* Inputs */}
                    <div className="glass-card p-10 border-border-subtle bg-surface-elevated space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Instrument Group</label>
                                <select
                                    value={pair}
                                    onChange={(e) => setPair(e.target.value)}
                                    className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-lg font-black text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                >
                                    {INSTRUMENTS.map(inst => (
                                        <option key={inst} value={inst}>{inst}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Account Balance ($)</label>
                                <input
                                    type="number"
                                    value={balance}
                                    onChange={(e) => setBalance(Number(e.target.value))}
                                    className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Risk Percentage (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={riskPercent}
                                    onChange={(e) => setRiskPercent(Number(e.target.value))}
                                    className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Stop Loss Input Mode</label>
                                    <button
                                        onClick={() => setInputMode(inputMode === 'pips' ? 'price' : 'pips')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-primary/40 transition-all"
                                    >
                                        <ArrowRightLeft size={12} />
                                        {inputMode === 'pips' ? 'Use Entry / SL Price' : 'Use Pips'}
                                    </button>
                                </div>

                                {inputMode === 'pips' ? (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Stop Loss (Pips)</label>
                                        <input
                                            type="number"
                                            value={stopLossPips}
                                            onChange={(e) => setStopLossPips(Number(e.target.value))}
                                            className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Entry Price</label>
                                            <input
                                                type="number"
                                                step="0.00001"
                                                value={entryPrice || ''}
                                                onChange={(e) => setEntryPrice(Number(e.target.value))}
                                                placeholder="0.00"
                                                className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all placeholder:text-text-muted"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">SL Price</label>
                                            <input
                                                type="number"
                                                step="0.00001"
                                                value={slPrice || ''}
                                                onChange={(e) => setSlPrice(Number(e.target.value))}
                                                placeholder="0.00"
                                                className="w-full bg-surface-elevated border border-border-color rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-primary/50 transition-all placeholder:text-text-muted"
                                            />
                                        </div>
                                    </div>
                                )}
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
                            {inputMode === 'price' && effectivePips > 0 && (
                                <p className="text-[10px] font-bold text-text-muted mt-4">
                                    SL distance: {fmtDecimals(effectivePips, 1)} pips
                                </p>
                            )}
                        </div>

                        <div className="glass-card p-10 border-border-subtle bg-surface-elevated space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Capital At Risk</p>
                                    <h4 className="text-2xl font-black text-white">{formatAmount(riskAmount)}</h4>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20">
                                    <ShieldAlert size={20} />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-border-subtle space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                                    <span>Pip Value (Approx)</span>
                                    <span className="text-white">{symbol}{pipValue.toFixed(2)}/lot</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                                    <span>SL Distance</span>
                                    <span className="text-white">{effectivePips > 0 ? fmtDecimals(effectivePips, 1) + ' pips' : '—'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                                    <span>Risk/Reward Ratio</span>
                                    <span className="text-primary">1:3.0 Target</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footnote */}
                <div className="flex items-start gap-4 p-8 glass-card border-border-subtle bg-surface-elevated border-dashed">
                    <Info size={20} className="text-text-muted shrink-0 mt-1" />
                    <p className="text-[10px] font-bold text-text-muted leading-relaxed uppercase tracking-widest">
                        Notice: Calculations are based on standard contract sizes. For indices and crypto, contract specifications may vary by broker terminal. Always verify computed size against your Margin requirements before execution.
                    </p>
                </div>
            </div>
        </DashboardShell>
    );
}
