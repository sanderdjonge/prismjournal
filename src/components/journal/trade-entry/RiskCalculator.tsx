'use client';

import React from 'react';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';

interface RiskCalculatorProps {
    computedPnl: number | null;
}

export function RiskCalculator({ computedPnl }: RiskCalculatorProps) {
    const { formatPnl } = useCurrency();
    
    return (
        <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                <Calculator size={10} /> Calculated P&L
            </label>
            <div className={cn(
                "w-full rounded-xl p-3 text-sm font-black border flex items-center gap-2",
                computedPnl === null 
                    ? "bg-white/5 border-white/5 text-gray-600"
                    : computedPnl >= 0 
                        ? "bg-accent/5 border-accent/20 text-accent" 
                        : "bg-danger/5 border-danger/20 text-danger"
            )}>
                {computedPnl === null 
                    ? '—' 
                    : formatPnl(computedPnl)
                }
            </div>
        </div>
    );
}
