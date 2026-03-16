'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, TrendingUp, TrendingDown, Zap, Brain, FileText, CheckCircle2, XCircle, Meh, ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { JournalTrade } from '@/app/journal/page';
import { MOOD_CONFIG } from '@/constants/tradeConfig';

interface TradeViewModalProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
}

interface MediaItem {
    id: string;
    url: string;
    timeframe: string;
}


export default function TradeViewModal({ trade, isOpen, onClose, onEdit }: TradeViewModalProps) {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);

    // Fetch media when modal opens
    useEffect(() => {
        if (trade && isOpen) {
            setLoadingMedia(true);
            fetch(`/api/trades/${trade.id}`)
                .then(res => res.json())
                .then(data => {
                    setMedia(data.media || []);
                    setLoadingMedia(false);
                })
                .catch(() => setLoadingMedia(false));
        } else {
            setMedia([]);
        }
    }, [trade, isOpen]);

    if (!trade) return null;

    const isClosed = !!trade.exitTime;
    const moodKey = (trade.mood || 'NEUTRAL') as keyof typeof MOOD_CONFIG;
    const MoodIcon = MOOD_CONFIG[moodKey]?.icon || Meh;
    const moodConfig = MOOD_CONFIG[moodKey] || MOOD_CONFIG.NEUTRAL;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] glass-card bg-[#0a0a0a] border-white/5 z-[101] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">View Trade</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Read-Only Trade Details</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={onEdit}
                                    className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                                >
                                    Edit
                                </button>
                                <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                            {/* Account badge */}
                            {(trade as { accountName?: string }).accountName && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Account:</span>
                                    <span className="text-xs font-bold text-white">{(trade as { accountName?: string }).accountName}</span>
                                </div>
                            )}

                            {/* Row 1: Instrument + Side + Volume */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Instrument</label>
                                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white font-mono uppercase">
                                        {trade.symbol}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Direction</label>
                                    <div className={cn(
                                        "flex items-center justify-center gap-2 p-3 rounded-xl h-[46px]",
                                        trade.type === 'LONG' ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                                    )}>
                                        {trade.type === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{trade.type === 'LONG' ? 'Long' : 'Short'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Volume (Lots)</label>
                                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.volume.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Entry / Exit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Entry Price</label>
                                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.entry.toFixed(5)}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Exit Price</label>
                                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.exit?.toFixed(5) || '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Trade Status */}
                            <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                                <div className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center",
                                    isClosed ? "bg-accent text-black" : "bg-secondary/20 text-secondary"
                                )}>
                                    <CheckCircle2 size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">
                                        {isClosed ? 'Trade Closed' : 'Trade Open'}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                        P&L: <span className={trade.pnl >= 0 ? 'text-accent' : 'text-danger'}>
                                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Row 3: TP / SL */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                                        <TrendingUp size={10} className="text-accent" /> Take Profit
                                    </label>
                                    <div className="w-full bg-accent/5 border border-accent/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.takeProfit?.toFixed(5) || '—'}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                                        <TrendingDown size={10} className="text-danger" /> Stop Loss
                                    </label>
                                    <div className="w-full bg-danger/5 border border-danger/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.stopLoss?.toFixed(5) || '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Strategy, Compliance, Mood, Notes */}
                            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                                            <Zap size={10} /> Strategy
                                        </label>
                                        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white">
                                            {trade.strategy || '—'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Plan Compliance</label>
                                        <div className="flex gap-3">
                                            <div className={cn(
                                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                                trade.planCompliance === 'FOLLOWED' 
                                                    ? "bg-accent/10 border-accent/40 text-accent" 
                                                    : "bg-white/5 border-transparent text-gray-600"
                                            )}>
                                                <CheckCircle2 size={14} /> Followed
                                            </div>
                                            <div className={cn(
                                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                                trade.planCompliance === 'DEVIATED' 
                                                    ? "bg-danger/10 border-danger/40 text-danger" 
                                                    : "bg-white/5 border-transparent text-gray-600"
                                            )}>
                                                <XCircle size={14} /> Deviated
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                                            <Brain size={10} /> Psychological State
                                        </label>
                                        <div className={cn(
                                            "p-3 rounded-xl border flex items-center gap-3",
                                            moodConfig.bg, "border-white/20"
                                        )}>
                                            <MoodIcon size={18} className={moodConfig.color} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                                {trade.mood || 'NEUTRAL'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                                            <FileText size={10} /> Notes
                                        </label>
                                        <div className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-300 overflow-y-auto">
                                            {trade.notes || 'No notes'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Screenshots Section */}
                            {loadingMedia ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                                </div>
                            ) : media.length > 0 ? (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">
                                        Screenshots
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {media.map((item) => (
                                            <div
                                                key={item.id}
                                                className="relative aspect-square rounded-lg overflow-hidden bg-white/5 group cursor-pointer"
                                                onClick={() => {
                                                    const newWindow = window.open();
                                                    if (newWindow) {
                                                        newWindow.document.write(`<img src="${item.url}" style="max-width:100%;max-height:100vh;margin:auto;display:block;" />`);
                                                        newWindow.document.close();
                                                    }
                                                }}
                                            >
                                                <img
                                                    src={item.url}
                                                    alt={`Screenshot ${item.timeframe}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                                                    <p className="text-[8px] text-white truncate">{item.timeframe}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
                                    <ImageOff size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No Screenshots</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-white/[0.02]">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
