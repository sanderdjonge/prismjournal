// src/components/ui/Badge.tsx
import { cn } from '@/lib/cn';

type BadgeVariant = 'win' | 'loss' | 'open' | 'long' | 'short' | 'neutral' | 'primary';

const variants: Record<BadgeVariant, string> = {
    win:     'bg-profit/10 text-profit border-profit/20',
    loss:    'bg-loss/10 text-loss border-loss/20',
    open:    'bg-primary/10 text-primary border-primary/20',
    long:    'bg-profit/10 text-profit border-profit/20',
    short:   'bg-loss/10 text-loss border-loss/20',
    neutral: 'bg-surface-elevated text-text-muted border-border-color',
    primary: 'bg-primary/10 text-primary border-primary/20',
};

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
    return (
        <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-widest',
            variants[variant],
            className,
        )}>
            {children}
        </span>
    );
}
