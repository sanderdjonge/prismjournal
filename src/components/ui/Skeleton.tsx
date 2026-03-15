// src/components/ui/Skeleton.tsx
import { cn } from '@/lib/cn';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div className={cn('animate-pulse rounded-xl bg-white/5', className)} />
    );
}

export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div className={cn('glass-card p-6 space-y-3', className)}>
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
        </div>
    );
}

export function SkeletonRow() {
    return (
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 ml-auto" />
        </div>
    );
}
