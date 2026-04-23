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
        <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-xl p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">{label}</div>
            <div className={cn(
                "text-xl font-black tracking-tight",
                variant === 'profit' && "text-profit",
                variant === 'loss' && "text-loss",
                variant === 'neutral' && "text-text-primary"
            )}>
                {value}
            </div>
            {subLabel && (
                <div className="text-[9px] text-text-muted font-bold mt-1">{subLabel}</div>
            )}
        </div>
    );
}

export default StatCard;
