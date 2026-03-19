import { cn } from '@/lib/cn';

type StatCardProps = {
    label: string;
    value: string;
    trend?: string;
    variant?: 'primary' | 'secondary' | 'accent' | 'danger';
};

const variants = {
    primary: 'text-primary border-primary/20 bg-primary/5 hover:border-primary/50',
    secondary: 'text-secondary border-secondary/20 bg-secondary/5 hover:border-secondary/50',
    accent: 'text-accent border-accent/20 bg-accent/5 hover:border-accent/50',
    danger: 'text-loss border-loss/20 bg-loss/5 hover:border-loss/50',
};

export default function StatCard({ label, value, trend, variant = 'primary' }: StatCardProps) {
    return (
        <div className={cn(
            "glass-card p-6 transition-all duration-300 group cursor-default",
            variants[variant]
        )}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest group-hover:text-gray-400 transition-colors">
                {label}
            </p>
            <div className="flex items-baseline gap-3 mt-2">
                <h2 className="text-3xl font-bold tracking-tight">{value}</h2>
            </div>
            {trend && (
                <p className="text-xs text-gray-400 mt-1 font-medium italic">
                    {trend} <span className="text-gray-600 not-italic ml-1 opacity-50">vs last month</span>
                </p>
            )}
        </div>
    );
}
