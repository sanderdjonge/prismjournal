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
                <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
                    {label}
                </label>
            )}
            <input
                ref={ref}
                id={id}
                className={cn(
                    'w-full bg-black/40 border rounded-2xl px-5 py-3 text-white font-bold outline-none transition-all placeholder:text-gray-600',
                    error
                        ? 'border-danger/50 focus:border-danger'
                        : 'border-white/10 focus:border-primary/50',
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
