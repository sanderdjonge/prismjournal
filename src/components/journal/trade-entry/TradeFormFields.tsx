'use client';

import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TradeFormFieldsProps {
    symbol: string;
    onSymbolChange: (value: string) => void;
    side: 'BUY' | 'SELL';
    onSideChange: (value: 'BUY' | 'SELL') => void;
    volume: string;
    onVolumeChange: (value: string) => void;
    entryPrice: string;
    onEntryPriceChange: (value: string) => void;
    exitPrice: string;
    onExitPriceChange: (value: string) => void;
    takeProfit: string;
    onTakeProfitChange: (value: string) => void;
    stopLoss: string;
    onStopLossChange: (value: string) => void;
    isClosed: boolean;
    onIsClosedChange: (value: boolean) => void;
}

export function TradeFormFields({
    symbol,
    onSymbolChange,
    side,
    onSideChange,
    volume,
    onVolumeChange,
    entryPrice,
    onEntryPriceChange,
    exitPrice,
    onExitPriceChange,
    takeProfit,
    onTakeProfitChange,
    stopLoss,
    onStopLossChange,
    isClosed,
    onIsClosedChange,
}: TradeFormFieldsProps) {
    return (
        <>
            {/* Row 1: Instrument + Side + Volume */}
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Instrument</label>
                    <input
                        value={symbol} 
                        onChange={e => onSymbolChange(e.target.value)}
                        placeholder="e.g. NAS100"
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all font-mono uppercase"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Direction</label>
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 h-[46px]">
                        <button 
                            onClick={() => onSideChange('BUY')}
                            className={cn(
                                "flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                                side === 'BUY' ? "bg-accent text-black shadow-lg" : "text-gray-500 hover:text-white"
                            )}
                        >
                            <TrendingUp size={12} /> Buy
                        </button>
                        <button 
                            onClick={() => onSideChange('SELL')}
                            className={cn(
                                "flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                                side === 'SELL' ? "bg-danger text-white shadow-lg" : "text-gray-500 hover:text-white"
                            )}
                        >
                            <TrendingDown size={12} /> Sell
                        </button>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Volume (Lots)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        value={volume} 
                        onChange={e => onVolumeChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all" 
                    />
                </div>
            </div>

            {/* Row 2: Entry / Exit */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Entry Price</label>
                    <input 
                        type="number" 
                        value={entryPrice} 
                        onChange={e => onEntryPriceChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all" 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">
                        Exit Price {isClosed && <span className="text-danger">*</span>}
                    </label>
                    <input 
                        type="number" 
                        value={exitPrice} 
                        onChange={e => onExitPriceChange(e.target.value)}
                        placeholder={isClosed ? "Required for closed trades" : "Leave empty for open trades"}
                        className={cn(
                            "w-full bg-white/5 border rounded-xl p-3 text-sm font-bold text-white outline-none transition-all",
                            isClosed ? "border-danger/50 focus:border-danger" : "border-white/10 focus:border-primary/50"
                        )} 
                    />
                </div>
            </div>

            {/* Trade Status Toggle */}
            <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <button
                    type="button"
                    onClick={() => onIsClosedChange(!isClosed)}
                    className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                        isClosed 
                            ? "bg-accent text-black" 
                            : "bg-white/10 text-gray-500 hover:bg-white/20"
                    )}
                >
                    {isClosed && <CheckCircle size={14} />}
                </button>
                <div>
                    <p className="text-xs font-bold text-white">
                        {isClosed ? 'Trade Closed' : 'Trade Open'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                        {isClosed 
                            ? 'This trade has been closed with an exit price' 
                            : 'Click to mark as closed and enter exit price'
                        }
                    </p>
                </div>
            </div>

            {/* Row 3: TP / SL */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                        <TrendingUp size={10} className="text-accent" /> Take Profit
                    </label>
                    <input 
                        type="number" 
                        value={takeProfit} 
                        onChange={e => onTakeProfitChange(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-accent/5 border border-accent/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-accent/40 transition-all" 
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                        <TrendingDown size={10} className="text-danger" /> Stop Loss
                    </label>
                    <input 
                        type="number" 
                        value={stopLoss} 
                        onChange={e => onStopLossChange(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-danger/5 border border-danger/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-danger/40 transition-all" 
                    />
                </div>
            </div>
        </>
    );
}
