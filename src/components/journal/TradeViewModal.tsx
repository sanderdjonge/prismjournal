'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, TrendingUp, TrendingDown, Zap, Brain, FileText, CheckCircle2, XCircle, Meh, ImageOff, Share2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fmtDecimals } from '@/lib/formatNumber';
import type { JournalTrade } from '@/app/journal/page';
import { MOOD_CONFIG } from '@/constants/tradeConfig';
import { Lightbox } from './trade-analysis';
import { CloseReasonBadge } from '@/components/ui/CloseReasonBadge';
import { ExcursionBar } from '@/components/journal/ExcursionBar';
import { ShareTradeModal } from '@/components/trades/ShareTradeModal';
import { Spinner } from '@/components/ui/Spinner';

interface TradeViewModalProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
}

import type { MediaItem } from '@/types/trade'


export default function TradeViewModal({ trade, isOpen, onClose, onEdit }: TradeViewModalProps) {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

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
        <>
        {lightboxUrl && <Lightbox src={lightboxUrl} alt="Trade screenshot" onClose={() => setLightboxUrl(null)} />}
        {trade && (
            <ShareTradeModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                tradeId={trade.id}
                symbol={trade.symbol}
                direction={trade.type}
                pnl={trade.pnl}
            />
        )}
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
                        className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-4xl md:max-h-[90vh] glass-card bg-surface border-border-subtle z-[101] shadow-2xl flex flex-col overflow-hidden md:rounded-2xl"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-elevated">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">View Trade</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Read-Only Trade Details</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShareModalOpen(true)}
                                    className="px-4 py-2 rounded-lg bg-surface-elevated text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-surface-hover hover:text-text-primary transition-all flex items-center gap-1.5"
                                    title="Share trade"
                                >
                                    <Share2 size={12} />
                                    Share
                                </button>
                                <button
                                    onClick={onEdit}
                                    className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                                >
                                    Edit
                                </button>
                                <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                            {/* Account badge */}
                            {(trade as { accountName?: string }).accountName && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border-color rounded-xl">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Account:</span>
                                    <span className="text-xs font-bold text-white">{(trade as { accountName?: string }).accountName}</span>
                                </div>
                            )}

                            {/* Row 1: Instrument + Side + Volume */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Instrument</label>
                                    <div className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-white font-mono uppercase">
                                        {trade.symbol}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Direction</label>
                                    <div className={cn(
                                        "flex items-center justify-center gap-2 p-3 rounded-xl h-[46px]",
                                        trade.type === 'LONG' ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                                    )}>
                                        {trade.type === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{trade.type === 'LONG' ? 'Long' : 'Short'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Volume (Lots)</label>
                                    <div className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.volume.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Entry / Exit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Entry Price</label>
                                    <div className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.entry.toFixed(5)}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Exit Price</label>
                                    <div className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.exit?.toFixed(5) || '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Trade Status */}
                            <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border-subtle">
                                <div className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center",
                                    isClosed ? "bg-profit text-black" : "bg-secondary/20 text-secondary"
                                )}>
                                    <CheckCircle2 size={14} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white">
                                        {isClosed ? 'Trade Closed' : 'Trade Open'}
                                    </p>
                                    <p className="text-[10px] text-text-muted">
                                        P&L: <span className={trade.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                                            {trade.pnl >= 0 ? '+' : ''}{fmtDecimals(trade.pnl, 2)}
                                        </span>
                                    </p>
                                </div>
                                {isClosed && (
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Closed By</span>
                                        <CloseReasonBadge reason={(trade as { closeReason?: string | null }).closeReason} />
                                    </div>
                                )}
                            </div>

                            {/* Row 3: TP / SL */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                                        <TrendingUp size={10} className="text-profit" /> Take Profit
                                    </label>
                                    <div className="w-full bg-profit/5 border border-profit/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.takeProfit?.toFixed(5) || '—'}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                                        <TrendingDown size={10} className="text-loss" /> Stop Loss
                                    </label>
                                    <div className="w-full bg-loss/5 border border-loss/10 rounded-xl p-3 text-sm font-bold text-white">
                                        {trade.stopLoss?.toFixed(5) || '—'}
                                    </div>
                                    {/* Show initial SL if different from current SL */}
                                    {trade.initialStopLoss != null && trade.initialStopLoss !== trade.stopLoss && (
                                        <div className="text-[10px] text-text-muted mt-1 px-1 flex items-center gap-1">
                                            <span className="text-text-muted">Initial:</span>
                                            <span className="font-mono">{trade.initialStopLoss.toFixed(5)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Exit Efficiency */}
                            {isClosed && (
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Exit Efficiency</label>
                                    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-3">
                                        <ExcursionBar
                                            mae={trade.mae}
                                            mfe={trade.mfe}
                                            exitDistFromEntry={
                                                trade.exit && trade.entry
                                                    ? trade.type === 'LONG'
                                                        ? trade.exit - trade.entry
                                                        : trade.entry - trade.exit
                                                    : null
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Strategy, Compliance, Mood, Notes */}
                            <div className="pt-4 border-t border-border-subtle grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                                            <Zap size={10} /> Strategy
                                        </label>
                                        <div className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-white">
                                            {trade.strategy || '—'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Plan Compliance</label>
                                        <div className="flex gap-3">
                                            <div className={cn(
                                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                                trade.planCompliance === 'FOLLOWED'
                                                    ? "bg-profit/10 border-profit/40 text-profit"
                                                    : "bg-surface-elevated border-transparent text-text-muted"
                                            )}>
                                                <CheckCircle2 size={14} /> Followed
                                            </div>
                                            <div className={cn(
                                                "flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                                trade.planCompliance === 'DEVIATED'
                                                    ? "bg-loss/10 border-loss/40 text-loss"
                                                    : "bg-surface-elevated border-transparent text-text-muted"
                                            )}>
                                                <XCircle size={14} /> Deviated
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                                            <Brain size={10} /> Psychological State
                                        </label>
                                        <div className={cn(
                                            "p-3 rounded-xl border flex items-center gap-3",
                                            moodConfig.bg, "border-border-color"
                                        )}>
                                            <MoodIcon size={18} className={moodConfig.color} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                                {trade.mood || 'NEUTRAL'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                                            <FileText size={10} /> Notes
                                        </label>
                                        <div className="w-full h-20 bg-surface-elevated border border-border-color rounded-xl p-3 text-xs text-text-secondary overflow-y-auto">
                                            {trade.notes || 'No notes'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Screenshots Section */}
                            {loadingMedia ? (
                                <div className="flex items-center justify-center py-8">
                                    <Spinner size="sm" className="border-border-color border-t-primary" />
                                </div>
                            ) : media.length > 0 ? (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">
                                        Screenshots
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {media.map((item) => (
                                            <div
                                                key={item.id}
                                                className="relative aspect-square rounded-lg overflow-hidden bg-surface-elevated group cursor-pointer"
                                                onClick={() => setLightboxUrl(item.url)}
                                            >
                                                <img
                                                    src={item.url}
                                                    alt={`Screenshot ${item.timeframe}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 flex items-center justify-between gap-1">
                                                    <p className="text-[8px] text-white truncate">{item.timeframe}</p>
                                                    <span className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${item.event === 'CLOSE' ? 'text-loss' : 'text-primary'}`}>
                                                        {item.event === 'CLOSE' ? 'EXIT' : 'ENTRY'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
                                    <ImageOff size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No Screenshots</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-border-subtle flex justify-end gap-3 bg-surface-elevated">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-surface-elevated border border-border-color text-white font-black uppercase tracking-widest text-[10px] hover:bg-surface-hover transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
        </>
    );
}
