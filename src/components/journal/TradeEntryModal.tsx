'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Tag as TagIcon, Plus } from 'lucide-react';
import { useTags, useCreateTag } from '@/hooks/useTags';
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
import { useAccounts } from '@/hooks/useAccounts';

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
    accountId: undefined,
};

export default function TradeEntryModal({ isOpen, onClose, onSaved }: TradeEntryModalProps) {
    const [screenshots, setScreenshots] = useState<File[]>([]);
    const [computedPnl, setComputedPnl] = useState<number | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [newTagName, setNewTagName] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);

    const { accounts, selectedAccountId } = useAccounts();
    const { data: tagsData } = useTags();
    const createTag = useCreateTag();
    const allTags = tagsData?.tags ?? [];

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
    const accountId = watch('accountId');

    // Pre-select the account that's active in the topnav when modal opens
    useEffect(() => {
        if (isOpen && selectedAccountId) {
            setValue('accountId', selectedAccountId);
        }
    }, [isOpen, selectedAccountId, setValue]);

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
        setSelectedTagIds([]);
        setNewTagName('');
        setShowTagInput(false);
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
                    accountId: values.accountId || undefined,
                }),
            });
            if (!res.ok) throw new Error('Server error');
            const trade = await res.json();

            // Sync tags if any selected
            if (selectedTagIds.length > 0) {
                await fetch(`/api/trades/${trade.id}/tags`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tagIds: selectedTagIds }),
                });
            }

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
                                {/* Account Selector */}
                                {accounts && accounts.length > 1 && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                            Account
                                        </label>
                                        <select
                                            value={accountId || ''}
                                            onChange={(e) => setValue('accountId', e.target.value || undefined)}
                                            className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:border-primary/50 focus:outline-none"
                                        >
                                            <option value="">Default account</option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name}{acc.propFirm ? ` (${acc.propFirm.name})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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

                                {/* Tags */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1">
                                        <TagIcon size={10} /> Tags
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {allTags.map((tag) => {
                                            const selected = selectedTagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => setSelectedTagIds(prev =>
                                                        selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                                                    )}
                                                    className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all"
                                                    style={selected ? {
                                                        backgroundColor: `${tag.color || '#00f2ff'}20`,
                                                        color: tag.color || '#00f2ff',
                                                        borderColor: `${tag.color || '#00f2ff'}40`,
                                                    } : {
                                                        backgroundColor: 'transparent',
                                                        color: '#6b7280',
                                                        borderColor: 'rgba(255,255,255,0.1)',
                                                    }}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => setShowTagInput(!showTagInput)}
                                            className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all flex items-center gap-1"
                                        >
                                            <Plus size={9} /> New
                                        </button>
                                    </div>
                                    {showTagInput && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newTagName}
                                                onChange={(e) => setNewTagName(e.target.value)}
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (!newTagName.trim()) return;
                                                        const tag = await createTag.mutateAsync({ name: newTagName.trim() });
                                                        setSelectedTagIds(prev => [...prev, tag.id]);
                                                        setNewTagName('');
                                                        setShowTagInput(false);
                                                    }
                                                }}
                                                placeholder="Tag name (Enter to create)"
                                                className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-primary/50 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!newTagName.trim()) return;
                                                    const tag = await createTag.mutateAsync({ name: newTagName.trim() });
                                                    setSelectedTagIds(prev => [...prev, tag.id]);
                                                    setNewTagName('');
                                                    setShowTagInput(false);
                                                }}
                                                className="px-3 py-1.5 bg-primary/20 border border-primary/30 rounded-lg text-primary text-xs font-bold hover:bg-primary/30 transition-all"
                                            >
                                                Create
                                            </button>
                                        </div>
                                    )}
                                </div>

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
