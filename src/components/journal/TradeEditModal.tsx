'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { tradeFormSchema, type TradeFormValues } from '@/lib/validations/tradeForm';

interface MediaItem {
    id: string;
    url: string;
    timeframe: string;
}

interface TradeEditModalProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export default function TradeEditModal({ trade, isOpen, onClose, onSaved }: TradeEditModalProps) {
    const [screenshots, setScreenshots] = useState<File[]>([]);
    const [existingMedia, setExistingMedia] = useState<MediaItem[]>([]);
    const [computedPnl, setComputedPnl] = useState<number | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<TradeFormValues>({
        resolver: zodResolver(tradeFormSchema),
        defaultValues: {
            symbol: '',
            type: 'LONG',
            volume: 0.01,
            entryPrice: 0,
            exitPrice: '',
            takeProfit: '',
            stopLoss: '',
            isClosed: false,
            strategy: '',
            mood: undefined,
            planCompliance: undefined,
            notes: '',
        },
    });

    // Watch form values
    const symbol = watch('symbol');
    const side = watch('type');
    const volume = watch('volume');
    const entryPrice = watch('entryPrice');
    const exitPrice = watch('exitPrice');
    const isClosed = watch('isClosed');
    const strategy = watch('strategy');
    const mood = watch('mood');
    const planCompliance = watch('planCompliance');
    const notes = watch('notes');

    // Load trade data when modal opens
    useEffect(() => {
        if (trade && isOpen) {
            reset({
                symbol: trade.symbol,
                type: trade.type,
                volume: trade.volume,
                entryPrice: trade.entry,
                exitPrice: trade.exit != null ? String(trade.exit) : '',
                takeProfit: trade.takeProfit != null ? String(trade.takeProfit) : '',
                stopLoss: trade.stopLoss != null ? String(trade.stopLoss) : '',
                isClosed: !!trade.exitTime,
                strategy: trade.strategy || '',
                mood: trade.mood as TradeFormValues['mood'] || undefined,
                planCompliance: trade.planCompliance as TradeFormValues['planCompliance'] || undefined,
                notes: trade.notes || '',
            });
            setComputedPnl(trade.pnl);
            setScreenshots([]);

            // Load existing media
            fetch(`/api/trades/${trade.id}`)
                .then(res => res.json())
                .then(data => {
                    setExistingMedia(data.media || []);
                })
                .catch(() => setExistingMedia([]));
        }
    }, [trade, isOpen, reset]);

    // Auto-calculate PnL
    useEffect(() => {
        const e = entryPrice;
        const x = exitPrice ? Number(exitPrice) : NaN;
        const v = volume;
        if (typeof e === 'number' && !isNaN(x) && typeof v === 'number' && v > 0 && symbol?.trim()) {
            const cs = getContractSize(symbol.trim());
            setComputedPnl(Math.round(calcPnl(side, e, x, v, cs) * 100) / 100);
        } else {
            setComputedPnl(null);
        }
    }, [entryPrice, exitPrice, volume, side, symbol]);

    const handleClose = () => {
        onClose();
    };

    const onSubmit = async (values: TradeFormValues) => {
        if (!trade) return;

        try {
            const res = await fetch(`/api/trades/${trade.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: values.symbol.trim().toUpperCase(),
                    type: values.type,
                    volume: values.volume,
                    entryPrice: values.entryPrice,
                    exitPrice: values.isClosed && values.exitPrice ? Number(values.exitPrice) : undefined,
                    takeProfit: values.takeProfit ? Number(values.takeProfit) : undefined,
                    stopLoss: values.stopLoss ? Number(values.stopLoss) : undefined,
                    pnl: values.isClosed ? computedPnl ?? undefined : undefined,
                    status: values.isClosed ? 'CLOSED' : 'OPEN',
                    strategy: values.strategy,
                    mood: values.mood,
                    planCompliance: values.planCompliance,
                    notes: values.notes?.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error('Server error');

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

            toast.success('Trade updated successfully');
            onSaved();
        } catch {
            toast.error('Failed to save trade. Please try again.');
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

                        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                                {/* Trade Form Fields */}
                                <TradeFormFields
                                    register={register}
                                    errors={errors}
                                    setValue={setValue}
                                    watch={watch}
                                />

                                {/* Calculated P&L */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-start-3">
                                        <RiskCalculator computedPnl={computedPnl} />
                                    </div>
                                </div>

                                {/* Strategy, Compliance, Mood, Notes */}
                                <TradeEntryDetails
                                    strategy={strategy ?? ''}
                                    onStrategyChange={(v) => setValue('strategy', v)}
                                    compliance={planCompliance === 'FOLLOWED' ? true : planCompliance === 'DEVIATED' ? false : null}
                                    onComplianceChange={(v) => setValue('planCompliance', v === true ? 'FOLLOWED' : v === false ? 'DEVIATED' : undefined)}
                                    mood={mood ?? 'NEUTRAL'}
                                    onMoodChange={(v) => setValue('mood', v as TradeFormValues['mood'])}
                                    notes={notes ?? ''}
                                    onNotesChange={(v) => setValue('notes', v)}
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
                            </div>

                            <TradeFormActions
                                saving={isSubmitting}
                                onCancel={handleClose}
                            />
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
