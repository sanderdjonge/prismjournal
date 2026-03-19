// src/components/ui/Card.tsx
import { cn } from '@/lib/cn';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
    return (
        <div className={cn(
            'glass-card',
            glow && 'border-primary/20 bg-primary/5',
            className,
        )}>
            {children}
        </div>
    );
}
