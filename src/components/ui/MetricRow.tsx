'use client';

import { cn } from '@/lib/cn';

export function MetricRow({
    label,
    value,
    subValue,
    variant = 'neutral'
}: {
    label: string;
    value: string;
    subValue?: string;
    variant?: 'profit' | 'loss' | 'neutral';
}) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider">{label}</div>
            <div className="text-right">
                <div className={cn(
                    "text-sm font-black",
                    variant === 'profit' && "text-profit",
                    variant === 'loss' && "text-loss",
                    variant === 'neutral' && "text-text-primary"
                )}>
                    {value}
                </div>
                {subValue && (
                    <div className="text-[10px] text-text-muted font-medium">{subValue}</div>
                )}
            </div>
        </div>
    );
}

export default MetricRow;
