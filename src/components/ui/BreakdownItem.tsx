'use client';

import { cn } from '@/lib/cn';

export function BreakdownItem({
    label,
    value,
    variant = 'neutral'
}: {
    label: string;
    value: string;
    variant?: 'profit' | 'loss' | 'neutral';
}) {
    return (
        <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">{label}</div>
            <div className={cn(
                "text-lg font-bold",
                variant === 'profit' && "text-profit",
                variant === 'loss' && "text-loss",
                variant === 'neutral' && "text-text-primary"
            )}>
                {value}
            </div>
        </div>
    );
}

export default BreakdownItem;
