'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3 } from 'lucide-react';
import type { JournalTrade } from '@/app/journal/page';
import {
    TradeFormFields,
    RiskCalculator,
    TradeEntryDetails,
    TradeFormActions,
    ScreenshotUpload,
    ExistingScreenshots,
} from './trade-entry';
import { getContractSize, calcPnl } from '@/lib/tradeCalculations';

interface MediaItem {
    id: string;
    url: string;
    timeframe: string;
}

interface TradeEditModalProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onSaved: (updated: JournalTrade) => void;
}

export default function TradeEditModal({ trade, isOpen, onClose, onSaved }: TradeEditModalProps) {
    const [symbol, setSymbol] = useState('');
    const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
    const [volume, setVolume] = useState('');
    const [entryPrice, setEntryPrice] = useState('');
    const [exitPrice, setExitPrice] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [isClosed, setIsClosed] = useState(false);
    const [computedPnl, setComputedPnl] = useState<number | null>(null);
    const [strategy, setStrategy] = useState('Vector Momentum (H1)');
    const [mood, setMood] = useState<string>('NEUTRAL');
    const [compliance, setCompliance] = useState<boolean | null>(null);
    const [notes, setNotes] = useState('');
    const [screenshots, setScreenshots] = useState<File[]>([]);
    const [existingMedia, setExistingMedia] = useState<MediaItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Load trade data when modal opens
    useEffect(() => {
        if (trade) {
            setSymbol(trade.symbol);
            setSide(trade.type);
            setVolume(trade.volume.toString());
            setEntryPrice(trade.entry.toString());
            setExitPrice(trade.exit?.toString() || '');
            setTakeProfit(trade.takeProfit?.toString() || '');
            setStopLoss(trade.stopLoss?.toString() || '');
            setIsClosed(!!trade.exitTime);
            setStrategy(trade.strategy || 'Vector Momentum (H1)');
            setMood(trade.mood || 'NEUTRAL');
            setCompliance(trade.planCompliance === 'FOLLOWED' ? true : trade.planCompliance === 'DEVIATED' ? false : null);
            setNotes(trade.notes || '');
            setComputedPnl(trade.pnl);
            setScreenshots([]); // Reset new screenshots when loading trade
            setError(''); // Reset error state
            
            // Load existing media
            fetch(`/api/trades/${trade.id}`)
                .then(res => res.json())
                .then(data => {
                    setExistingMedia(data.media || []);
                })
                .catch(() => setExistingMedia([]));
        }
    }, [trade]);

    // Auto-calculate PnL whenever entry, exit, volume, side or symbol changes
    useEffect(() => {
        const e = parseFloat(entryPrice);
        const x = parseFloat(exitPrice);
        const v = parseFloat(volume);
        if (!isNaN(e) && !isNaN(x) && !isNaN(v) && v > 0 && symbol.trim()) {
            const cs = getContractSize(symbol.trim());
            setComputedPnl(Math.round(calcPnl(side, e, x, v, cs) * 100) / 100);
        } else {
            setComputedPnl(null);
        }
    }, [entryPrice, exitPrice, volume, side, symbol]);

    const handleClose = () => {
        setError('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!trade) return;
        if (!symbol.trim()) { setError('Instrument is required.'); return; }
        if (!volume || isNaN(Number(volume))) { setError('Valid volume is required.'); return; }
        if (!entryPrice || isNaN(Number(entryPrice))) { setError('Valid entry price is required.'); return; }
        if (isClosed && (!exitPrice || isNaN(Number(exitPrice)))) { setError('Exit price is required for closed trades.'); return; }

        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/trades/${trade.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol.trim().toUpperCase(),
                    type: side,
                    volume: Number(volume),
                    entryPrice: Number(entryPrice),
                    exitPrice: isClosed && exitPrice ? Number(exitPrice) : undefined,
                    takeProfit: takeProfit ? Number(takeProfit) : undefined,
                    stopLoss: stopLoss ? Number(stopLoss) : undefined,
                    pnl: isClosed ? computedPnl ?? undefined : undefined,
                    status: isClosed ? 'CLOSED' : 'OPEN',
                    strategy,
                    mood,
                    planCompliance: compliance === true ? 'FOLLOWED' : compliance === false ? 'DEVIATED' : undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error('Server error');
            const updated = await res.json();

            // Upload screenshots if any
            if (screenshots.length > 0) {
                for (let i = 0; i < screenshots.length; i++) {
                    const formData = new FormData();
                    formData.append('file', screenshots[i]);
                    formData.append('timeframe', `SCREENSHOT_${i + 1}`);
                    
                    await fetch(`/api/trades/${trade.id}/upload`, {
                        method: 'POST',
                        body: formData,
                    });
                }
            }

            onSaved({
                ...trade,
                symbol: symbol.trim().toUpperCase(),
                type: side,
                volume: Number(volume),
                entry: Number(entryPrice),
                exit: exitPrice ? Number(exitPrice) : trade.exit,
                takeProfit: takeProfit ? Number(takeProfit) : null,
                stopLoss: stopLoss ? Number(stopLoss) : null,
                pnl: computedPnl ?? trade.pnl,
                strategy,
                mood,
                planCompliance: compliance === true ? 'FOLLOWED' : compliance === false ? 'DEVIATED' : undefined,
                notes,
            });
            onClose();
        } catch {
            setError('Failed to save trade. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!trade) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={handleClose}
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
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Edit3 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Edit Trade</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Modify Trade Details</p>
                                </div>
                            </div>
                            <button onClick={handleClose} className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                            {/* Trade Form Fields */}
                            <TradeFormFields
                                symbol={symbol}
                                onSymbolChange={setSymbol}
                                side={side}
                                onSideChange={setSide}
                                volume={volume}
                                onVolumeChange={setVolume}
                                entryPrice={entryPrice}
                                onEntryPriceChange={setEntryPrice}
                                exitPrice={exitPrice}
                                onExitPriceChange={setExitPrice}
                                takeProfit={takeProfit}
                                onTakeProfitChange={setTakeProfit}
                                stopLoss={stopLoss}
                                onStopLossChange={setStopLoss}
                                isClosed={isClosed}
                                onIsClosedChange={setIsClosed}
                            />

                            {/* Calculated P&L */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-start-3">
                                    <RiskCalculator computedPnl={computedPnl} />
                                </div>
                            </div>

                            {/* Strategy, Compliance, Mood, Notes */}
                            <TradeEntryDetails
                                strategy={strategy}
                                onStrategyChange={setStrategy}
                                compliance={compliance}
                                onComplianceChange={setCompliance}
                                mood={mood}
                                onMoodChange={setMood}
                                notes={notes}
                                onNotesChange={setNotes}
                            />

                            {/* Existing Screenshots */}
                            {existingMedia.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">
                                        Existing Screenshots
                                    </label>
                                    <ExistingScreenshots
                                        media={existingMedia}
                                        onRemove={(id) => {
                                            const newMedia = existingMedia.filter(m => m.id !== id);
                                            setExistingMedia(newMedia);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Screenshot Upload */}
                            <ScreenshotUpload
                                screenshots={screenshots}
                                onScreenshotsChange={setScreenshots}
                                maxFiles={5 - existingMedia.length}
                            />

                            {error && <p className="text-danger text-[10px] font-black uppercase tracking-widest">{error}</p>}
                        </div>

                        <TradeFormActions
                            saving={saving}
                            onCancel={handleClose}
                            onSubmit={handleSubmit}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
