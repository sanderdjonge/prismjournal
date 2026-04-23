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
            <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center gap-1.5">
                <Calculator size={10} /> Calculated P&L
            </label>
            <div className={cn(
                "w-full rounded-xl p-3 text-sm font-black border flex items-center gap-2",
                computedPnl === null
                    ? "bg-surface-elevated border-border-subtle text-text-muted"
                    : computedPnl >= 0
                        ? "bg-profit/5 border-profit/20 text-profit"
                        : "bg-loss/5 border-loss/20 text-loss"
            )}>
                {computedPnl === null 
                    ? '—' 
                    : formatPnl(computedPnl)
                }
            </div>
        </div>
    );
}
