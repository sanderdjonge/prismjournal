'use client';

import React from 'react';
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ComplianceSelectorProps {
    value: string;
    onChange: (compliance: string) => void;
    strategy?: string | null;
}

export function ComplianceSelector({ value, onChange, strategy }: ComplianceSelectorProps) {
    return (
        <section>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
                <ClipboardCheck size={12} className="text-primary" /> Execution Quality
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="glass-card p-4 bg-white/5 space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600">Strategy</label>
                    <div className="text-xs font-bold text-white uppercase italic">{strategy ?? '—'}</div>
                </div>
                <div className="glass-card p-4 bg-white/5 space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600">Compliance</label>
                    <div className={cn(
                        "flex items-center gap-1.5 text-xs font-black uppercase",
                        value === 'FOLLOWED' ? "text-profit" : value === 'DEVIATED' ? "text-loss" : "text-gray-500"
                    )}>
                        {value === 'FOLLOWED' && <><CheckCircle2 size={12} /> Followed</>}
                        {value === 'DEVIATED' && <><XCircle size={12} /> Deviated</>}
                        {!value && '—'}
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => onChange('FOLLOWED')}
                    className={cn(
                        "flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-widest",
                        value === 'FOLLOWED'
                            ? "bg-profit/10 border-profit/40 text-profit"
                            : "bg-white/5 border-transparent text-gray-500 hover:text-gray-300"
                    )}
                >
                    <CheckCircle2 size={12} /> Followed
                </button>
                <button
                    onClick={() => onChange('DEVIATED')}
                    className={cn(
                        "flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-widest",
                        value === 'DEVIATED'
                            ? "bg-loss/10 border-loss/40 text-loss"
                            : "bg-white/5 border-transparent text-gray-500 hover:text-gray-300"
                    )}
                >
                    <XCircle size={12} /> Deviated
                </button>
            </div>
        </section>
    );
}
