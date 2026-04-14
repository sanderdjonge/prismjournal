'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    isLoading = false,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: 'bg-danger/10 text-danger border-danger/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        info: 'bg-primary/10 text-primary border-primary/20',
    };

    const buttonStyles = {
        danger: 'bg-danger hover:bg-danger/80',
        warning: 'bg-yellow-500 hover:bg-yellow-500/80 text-black',
        info: 'bg-primary hover:bg-primary/80 text-black',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative glass-card border-white/10 bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${variantStyles[variant]} border flex items-center justify-center mb-4`}>
                    <AlertTriangle size={24} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                    {title}
                </h3>

                {/* Message */}
                <p className="text-sm text-gray-400 mb-6">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 h-10 rounded-xl ${buttonStyles[variant]} text-white font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {isLoading ? (
                            <>
                                <Spinner size="sm" className="border-white/30 border-t-white" />
                                Processing...
                            </>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
