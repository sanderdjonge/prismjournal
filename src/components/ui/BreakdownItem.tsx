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
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</div>
            <div className={cn(
                "text-lg font-bold",
                variant === 'profit' && "text-profit",
                variant === 'loss' && "text-loss",
                variant === 'neutral' && "text-white"
            )}>
                {value}
            </div>
        </div>
    );
}

export default BreakdownItem;
