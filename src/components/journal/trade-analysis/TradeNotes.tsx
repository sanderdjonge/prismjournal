'use client';

import React from 'react';
import { Target } from 'lucide-react';

interface TradeNotesProps {
    value: string;
    onChange: (notes: string) => void;
}

export function TradeNotes({ value, onChange }: TradeNotesProps) {
    return (
        <section>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted border-b border-border-subtle pb-2 mb-3 flex items-center gap-2">
                <Target size={12} /> Trade Narrative
            </h3>
            <textarea 
                value={value} 
                onChange={e => onChange(e.target.value)}
                className="w-full h-28 glass-card bg-surface-elevated p-4 border-border-subtle text-text-secondary text-sm outline-none focus:border-primary/50 transition-all resize-none leading-relaxed placeholder:text-text-muted font-medium rounded-xl"
                placeholder="Describe the setup, execution, and what you'd do differently..." 
            />
        </section>
    );
}
