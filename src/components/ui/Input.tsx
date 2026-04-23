// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, id, ...props }, ref) => (
        <div className="space-y-1.5">
            {label && (
                <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-widest text-text-muted px-1">
                    {label}
                </label>
            )}
            <input
                ref={ref}
                id={id}
                className={cn(
                    'w-full bg-surface-elevated border rounded-2xl px-5 py-3 text-text-primary font-bold outline-none transition-all placeholder:text-text-muted',
                    error
                        ? 'border-danger/50 focus:border-danger'
                        : 'border-border-color focus:border-primary/50',
                    className,
                )}
                {...props}
            />
            {error && (
                <p className="text-[10px] font-bold text-danger px-1">{error}</p>
            )}
        </div>
    )
);
Input.displayName = 'Input';
