// src/components/ui/Badge.tsx
import { cn } from '@/lib/cn';

type BadgeVariant = 'win' | 'loss' | 'open' | 'long' | 'short' | 'neutral' | 'primary';

const variants: Record<BadgeVariant, string> = {
    win:     'bg-accent/10 text-accent border-accent/20',
    loss:    'bg-danger/10 text-danger border-danger/20',
    open:    'bg-primary/10 text-primary border-primary/20',
    long:    'bg-accent/10 text-accent border-accent/20',
    short:   'bg-danger/10 text-danger border-danger/20',
    neutral: 'bg-white/5 text-gray-400 border-white/10',
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
