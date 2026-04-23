'use client';

import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import { cn } from '@/lib/cn';
import type { TradeFormValues } from '@/lib/validations/tradeForm';

interface TradeFormFieldsProps {
    register: UseFormRegister<TradeFormValues>;
    errors: FieldErrors<TradeFormValues>;
    setValue: UseFormSetValue<TradeFormValues>;
    watch: UseFormWatch<TradeFormValues>;
    disabled?: boolean;
}

export function TradeFormFields({
    register,
    errors,
    setValue,
    watch,
    disabled = false,
}: TradeFormFieldsProps) {
    const side = watch('type');
    const isClosed = watch('isClosed');

    return (
        <>
            {/* Row 1: Instrument + Side + Volume */}
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Instrument</label>
                    <input
                        {...register('symbol')}
                        placeholder="e.g. NAS100"
                        disabled={disabled}
                        className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-text-primary outline-none focus:border-primary/50 transition-all font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.symbol && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.symbol.message}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Direction</label>
                    <div className="flex p-1 bg-surface-elevated rounded-xl border border-border-color h-[46px]">
                        <button
                            type="button"
                            onClick={() => !disabled && setValue('type', 'LONG', { shouldValidate: true })}
                            disabled={disabled}
                            className={cn(
                                "flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                                side === 'LONG' ? "bg-profit text-black shadow-lg" : "text-text-muted hover:text-text-primary",
                                disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <TrendingUp size={12} /> Long
                        </button>
                        <button
                            type="button"
                            onClick={() => !disabled && setValue('type', 'SHORT', { shouldValidate: true })}
                            disabled={disabled}
                            className={cn(
                                "flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                                side === 'SHORT' ? "bg-loss text-white shadow-lg" : "text-text-muted hover:text-text-primary",
                                disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <TrendingDown size={12} /> Short
                        </button>
                    </div>
                    {errors.type && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.type.message}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Volume (Lots)</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('volume')}
                        disabled={disabled}
                        className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-text-primary outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.volume && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.volume.message}</p>
                    )}
                </div>
            </div>

            {/* Row 2: Entry / Exit */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Entry Price</label>
                    <input
                        type="number"
                        step="0.00001"
                        {...register('entryPrice')}
                        disabled={disabled}
                        className="w-full bg-surface-elevated border border-border-color rounded-xl p-3 text-sm font-bold text-text-primary outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.entryPrice && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.entryPrice.message}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-1",
                        isClosed ? "text-text-muted" : "text-text-muted"
                    )}>
                        Exit Price {isClosed && <span className="text-danger">*</span>}
                    </label>
                    <input
                        type="number"
                        step="0.00001"
                        {...register('exitPrice')}
                        placeholder={isClosed ? "Required for closed trades" : "—"}
                        disabled={disabled || !isClosed}
                        className={cn(
                            "w-full border rounded-xl p-3 text-sm font-bold outline-none transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                            isClosed
                                ? "bg-surface-elevated border-danger/50 text-white focus:border-danger"
                                : "bg-surface-elevated border-border-subtle text-text-muted"
                        )}
                    />
                    {errors.exitPrice && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.exitPrice.message}</p>
                    )}
                </div>
            </div>

            {/* Trade Status Toggle */}
            <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border-subtle">
                <button
                    type="button"
                    onClick={() => !disabled && setValue('isClosed', !isClosed, { shouldValidate: true })}
                    disabled={disabled}
                    className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all disabled:cursor-not-allowed",
                        isClosed
                            ? "bg-profit text-black"
                            : "bg-surface-hover text-text-muted hover:bg-surface-hover"
                    )}
                >
                    {isClosed && <CheckCircle size={14} />}
                </button>
                <div>
                    <p className="text-xs font-bold text-white">
                        {isClosed ? 'Trade Closed' : 'Trade Open'}
                    </p>
                    <p className="text-[10px] text-text-muted">
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
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                        <TrendingUp size={10} className="text-profit" /> Take Profit
                    </label>
                    <input
                        type="number"
                        step="0.00001"
                        {...register('takeProfit')}
                        placeholder="Optional"
                        disabled={disabled}
                        className="w-full bg-profit/5 border border-profit/10 rounded-xl p-3 text-sm font-bold text-text-primary outline-none focus:border-profit/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.takeProfit && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.takeProfit.message}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                        <TrendingDown size={10} className="text-loss" /> Stop Loss
                    </label>
                    <input
                        type="number"
                        step="0.00001"
                        {...register('stopLoss')}
                        placeholder="Optional"
                        disabled={disabled}
                        className="w-full bg-loss/5 border border-loss/10 rounded-xl p-3 text-sm font-bold text-text-primary outline-none focus:border-loss/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.stopLoss && (
                        <p className="text-danger text-[10px] font-bold px-1">{errors.stopLoss.message}</p>
                    )}
                </div>
            </div>
        </>
    );
}
