'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target } from 'lucide-react';
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
} from './trade-entry';
import { getContractSize, calcPnl } from '@/lib/tradeCalculations';
import { tradeFormSchema, type TradeFormValues } from '@/lib/validations/tradeForm';

interface TradeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (trade: JournalTrade) => void;
}

const defaultValues: TradeFormValues = {
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
};

export default function TradeEntryModal({ isOpen, onClose, onSaved }: TradeEntryModalProps) {
    const [screenshots, setScreenshots] = useState<File[]>([]);
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
        defaultValues,
    });

    // Watch form values for PnL calculation
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

    // Auto-calculate PnL whenever entry, exit, volume, side or symbol changes
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

    const handleReset = () => {
        reset(defaultValues);
        setScreenshots([]);
        setComputedPnl(null);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const onSubmit = async (values: TradeFormValues) => {
        try {
            // Create the trade
            const res = await fetch('/api/trades', {
                method: 'POST',
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

            toast.success('Trade logged successfully');
            onSaved(trade);
            handleReset();
        } catch {
            toast.error('Failed to save trade. Please try again.');
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
                        className="fixed inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-4xl max-h-[90vh] glass-card bg-[#0a0a0a] border-white/5 z-[101] shadow-2xl flex flex-col overflow-hidden md:rounded-2xl"
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

                                {/* Screenshot Upload */}
                                <ScreenshotUpload
                                    screenshots={screenshots}
                                    onScreenshotsChange={setScreenshots}
                                    maxFiles={5}
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
