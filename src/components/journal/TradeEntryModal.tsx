'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target } from 'lucide-react';
import type { JournalTrade } from '@/app/journal/page';
import {
    TradeFormFields,
    RiskCalculator,
    TradeEntryDetails,
    TradeFormActions,
    ScreenshotUpload,
} from './trade-entry';
import { getContractSize, calcPnl } from '@/lib/tradeCalculations';

interface TradeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (trade: JournalTrade) => void;
}

export default function TradeEntryModal({ isOpen, onClose, onSaved }: TradeEntryModalProps) {
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
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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

    const reset = () => {
        setSymbol(''); setSide('LONG'); setVolume(''); setEntryPrice('');
        setExitPrice(''); setTakeProfit(''); setStopLoss('');
        setIsClosed(false);
        setComputedPnl(null); setStrategy('Vector Momentum (H1)');
        setMood('NEUTRAL'); setCompliance(null); setNotes(''); setScreenshots([]); setError('');
    };

    const handleClose = () => { reset(); onClose(); };

    const handleSubmit = async () => {
        if (!symbol.trim()) { setError('Instrument is required.'); return; }
        if (!volume || isNaN(Number(volume))) { setError('Valid volume is required.'); return; }
        if (!entryPrice || isNaN(Number(entryPrice))) { setError('Valid entry price is required.'); return; }
        if (isClosed && (!exitPrice || isNaN(Number(exitPrice)))) { setError('Exit price is required for closed trades.'); return; }

        setSaving(true);
        setError('');
        try {
            // Create the trade
            const res = await fetch('/api/trades', {
                method: 'POST',
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
            const trade = await res.json();

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

            onSaved(trade);
            reset();
        } catch {
            setError('Failed to save trade. Please try again.');
        } finally {
            setSaving(false);
        }
    };

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
                                    <Target size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Log Execution</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Manual Edge Registry</p>
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

                            {/* Screenshot Upload */}
                            <ScreenshotUpload
                                screenshots={screenshots}
                                onScreenshotsChange={setScreenshots}
                                maxFiles={5}
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
