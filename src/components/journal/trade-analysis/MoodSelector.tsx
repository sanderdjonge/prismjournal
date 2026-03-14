'use client';

import React from 'react';
import { Smile, Meh, Frown, Brain } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MoodSelectorProps {
    value: string;
    onChange: (mood: string) => void;
}

const MOOD_OPTIONS = [
    { id: 'CALM', icon: Smile, color: 'text-accent', bg: 'bg-accent/10 border-accent/20' },
    { id: 'NEUTRAL', icon: Meh, color: 'text-gray-500', bg: 'bg-white/5 border-white/10' },
    { id: 'ANXIOUS', icon: Frown, color: 'text-danger', bg: 'bg-danger/10 border-danger/20' },
];

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
    return (
        <section>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                <Brain size={12} className="text-secondary" /> Psychological Profile
            </h3>
            <div className="flex gap-3">
                {MOOD_OPTIONS.map((m) => (
                    <button 
                        key={m.id} 
                        onClick={() => onChange(m.id)}
                        className={cn(
                            "flex-1 glass-card p-3 border flex flex-col items-center gap-1.5 transition-all",
                            value === m.id ? m.bg : "bg-white/5 border-transparent opacity-50"
                        )}
                    >
                        <m.icon size={20} className={m.color} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white">{m.id}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
