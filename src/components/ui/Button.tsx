// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

const variants: Record<Variant, string> = {
    primary: 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50',
    secondary: 'bg-white/5 border-white/10 text-white hover:bg-white/10',
    ghost: 'border-transparent text-gray-400 hover:text-white hover:bg-white/5',
    danger: 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20 hover:border-danger/50',
};

const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-4 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'secondary', size = 'md', loading, disabled, children, ...props }, ref) => (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl border font-black uppercase tracking-widest transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed',
                variants[variant],
                sizes[size],
                className,
            )}
            {...props}
        >
            {loading && (
                <Spinner size="sm" className="border-current border-t-transparent" />
            )}
            {children}
        </button>
    )
);
Button.displayName = 'Button';
