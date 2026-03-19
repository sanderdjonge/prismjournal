'use client';

import { cn } from '@/lib/cn';

export function StatCard({
    label,
    value,
    subLabel,
    variant = 'neutral'
}: {
    label: string;
    value: string;
    subLabel?: string;
    variant?: 'profit' | 'loss' | 'neutral';
}) {
    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-xl p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</div>
            <div className={cn(
                "text-xl font-black tracking-tight",
                variant === 'profit' && "text-profit",
                variant === 'loss' && "text-loss",
                variant === 'neutral' && "text-white"
            )}>
                {value}
            </div>
            {subLabel && (
                <div className="text-[9px] text-gray-600 font-bold mt-1">{subLabel}</div>
            )}
        </div>
    );
}

export default StatCard;
