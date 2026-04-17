'use client';

import { cn } from '@/lib/cn';
import { fmtDecimals } from '@/lib/formatNumber';

interface GaugeProps {
    value: number;
    max?: number;
    label: string;
    subLabel?: string;
    variant?: 'primary' | 'accent' | 'secondary' | 'danger';
    className?: string;
}

export default function Gauge({
    value,
    max = 100,
    label,
    subLabel,
    variant = 'primary',
    className
}: GaugeProps) {
    const radius = 70; // Fit comfortably
    const stroke = 12;
    const normalizedWidth = 200;
    const normalizedHeight = 170;
    const centerX = 100;
    const centerY = 90; // Higher center to avoid clipping bottom

    // Start at bottom-ish left and end at bottom-ish right (300 degree arc)
    const startAngle = 210;
    const endAngle = 150;

    const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: cx + (r * Math.cos(angleInRadians)),
            y: cy + (r * Math.sin(angleInRadians))
        };
    };

    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, endAngle);

    // Arc path for the background
    const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;

    // Percentage calculation
    const percentage = Math.min(Math.max(value / max, 0), 1);
    const totalArc = 300;
    const progressAngle = startAngle + (totalArc * percentage);
    const progressEnd = polarToCartesian(centerX, centerY, radius, progressAngle);

    const largeArcFlag = totalArc * percentage > 180 ? 1 : 0;
    const progressPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${progressEnd.x} ${progressEnd.y}`;

    const colors = {
        primary: 'stroke-[var(--primary)] drop-shadow-[0_0_12px_rgba(0,242,255,0.5)]',
        accent: 'stroke-[var(--profit)] drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]',
        secondary: 'stroke-[var(--secondary)] drop-shadow-[0_0_12px_rgba(112,0,255,0.5)]',
        danger: 'stroke-[var(--loss)] drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]',
    };

    return (
        <div className={cn("flex flex-col items-center justify-center group/gauge w-full max-w-[160px]", className)}>
            <div className="relative w-full aspect-[200/170]">
                <svg
                    viewBox={`0 0 ${normalizedWidth} ${normalizedHeight}`}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <radialGradient id="gaugeGlass" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.05)" />
                            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.01)" />
                        </radialGradient>
                    </defs>
                    {/* Glassy Background Circle */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={radius + 15}
                        fill="url(#gaugeGlass)"
                        className="backdrop-blur-sm"
                    />
                    {/* Background Track */}
                    <path
                        d={arcPath}
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                    />
                    {/* Progress Bar */}
                    <path
                        d={progressPath}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        className={cn("transition-all duration-1000 ease-out", colors[variant])}
                    />
                </svg>

                {/* Center Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                    <span className="text-3xl font-black text-white tracking-tighter">
                        {fmtDecimals(value)}{max === 100 ? '%' : ''}
                    </span>
                    {subLabel && (
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mt-0.5">
                            {subLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* Title Below Gauge */}
            <div className="mt-1 text-center">
                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 group-hover/gauge:text-primary transition-colors">
                    {label}
                </h4>
            </div>
        </div>
    );
}
