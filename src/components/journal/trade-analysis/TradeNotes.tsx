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
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                <Target size={12} /> Trade Narrative
            </h3>
            <textarea 
                value={value} 
                onChange={e => onChange(e.target.value)}
                className="w-full h-28 glass-card bg-white/5 p-4 border-white/5 text-gray-300 text-sm outline-none focus:border-primary/50 transition-all resize-none leading-relaxed placeholder:text-gray-700 font-medium rounded-xl"
                placeholder="Describe the setup, execution, and what you'd do differently..." 
            />
        </section>
    );
}
