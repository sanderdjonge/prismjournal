'use client';

import React from 'react';
import { Save } from 'lucide-react';

interface TradeFormActionsProps {
    saving: boolean;
    onCancel: () => void;
    onSubmit?: () => void;
}

export function TradeFormActions({ saving, onCancel, onSubmit }: TradeFormActionsProps) {
    return (
        <div className="p-6 border-t border-border-subtle bg-surface-elevated flex gap-3">
            <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 rounded-xl border border-border-color text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-text-primary transition-all flex-1"
            >
                Discard
            </button>
            <button
                type="submit"
                onClick={onSubmit}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:brightness-110 active:scale-95 transition-all flex-[2] disabled:opacity-50"
            >
                <Save size={14} /> {saving ? 'Archiving...' : 'Archive Trade Record'}
            </button>
        </div>
    );
}
