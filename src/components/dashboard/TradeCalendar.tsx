'use client';

import dayjs from 'dayjs';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';

type TradeDay = {
    date: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
};

type TradeCalendarProps = {
    data: TradeDay[];
};

export default function TradeCalendar({ data }: TradeCalendarProps) {
    const { symbol } = useCurrency();
    const today = dayjs();
    const startOfMonth = today.startOf('month');
    const daysInMonth = today.daysInMonth();
    const startDay = startOfMonth.day(); // 0 (Sun) to 6 (Sat)

    const calendarDays = [];
    // Fill empty days before start of month
    for (let i = 0; i < startDay; i++) {
        calendarDays.push(null);
    }
    // Fill actual days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = startOfMonth.date(i).format('YYYY-MM-DD');
        const dayData = data.find(d => d.date === dateStr);
        calendarDays.push({ 
            date: i, 
            pnl: dayData?.pnl || 0,
            trades: dayData?.trades || 0,
            wins: dayData?.wins || 0,
            losses: dayData?.losses || 0
        });
    }

    const getPnlStyle = (pnl: number, hasTrades: boolean) => {
        if (!hasTrades) return {
            bg: "bg-white/5 hover:bg-white/10",
            border: "border-white/5",
            text: "text-gray-500",
        };
        if (pnl > 0) return {
            bg: "bg-[#10b981]/15 hover:bg-[#10b981]/25",
            border: "border-[#10b981]/30",
            text: "text-[#10b981]",
        };
        if (pnl < 0) return {
            bg: "bg-[#f43f5e]/15 hover:bg-[#f43f5e]/25",
            border: "border-[#f43f5e]/30",
            text: "text-[#f43f5e]",
        };
        // Breakeven (pnl === 0 but has trades)
        return {
            bg: "bg-secondary/15 hover:bg-secondary/25",
            border: "border-secondary/30",
            text: "text-secondary",
        };
    };

    return (
        <div className="p-4 h-full flex flex-col group/calendar overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 group-hover/calendar:text-gray-300 transition-colors">
                        Trade Calendar
                    </h3>
                    <p className="text-xl font-black text-white tracking-tight mt-1">
                        {today.format('MMMM YYYY')}
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                        <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Profits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]" />
                        <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Losses</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1 min-h-0 auto-rows-fr">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-black text-gray-600 pb-1 tracking-tighter">
                        {d}
                    </div>
                ))}
                {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="flex items-center justify-center" />;
                    const style = getPnlStyle(day.pnl, day.trades > 0);

                    return (
                        <div
                            key={i}
                            className={cn(
                                "rounded-lg flex flex-col items-center justify-center transition-all duration-300 border min-h-0 relative group/day cursor-pointer",
                                style.bg,
                                style.border
                            )}
                        >
                            <span className={cn("text-[10px] font-bold", day.trades > 0 ? "text-gray-400" : style.text)}>
                                {day.date}
                            </span>
                            {day.trades > 0 && (
                                <>
                                    <span className={cn("text-[11px] font-black leading-tight mt-0.5", style.text)}>
                                        {day.pnl > 0 ? '+' : ''}{symbol}{Math.abs(day.pnl).toFixed(0)}
                                    </span>
                                    <div className="flex gap-1 mt-0.5">
                                        {day.wins > 0 && (
                                            <span className="text-[8px] font-black text-accent">{day.wins}W</span>
                                        )}
                                        {day.losses > 0 && (
                                            <span className="text-[8px] font-black text-danger">{day.losses}L</span>
                                        )}
                                        {day.wins === 0 && day.losses === 0 && (
                                            <span className="text-[8px] font-black text-secondary">BE</span>
                                        )}
                                    </div>
                                </>
                            )}
                            
                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/day:opacity-100 pointer-events-none group-hover/day:pointer-events-auto transition-opacity duration-200 z-50">
                                <div className="bg-black/95 border border-white/20 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                    <p className="text-[10px] font-bold text-white">{startOfMonth.date(day.date).format('MMM D, YYYY')}</p>
                                    <p className={cn("text-xs font-black mt-1", style.text)}>
                                        {day.trades === 0 ? 'No trades' : `${day.trades} trade${day.trades > 1 ? 's' : ''} • ${day.pnl >= 0 ? '+' : ''}{symbol}${day.pnl.toFixed(2)}`}
                                    </p>
                                    {day.trades > 0 && (
                                        <p className="text-[9px] text-gray-400 mt-0.5">
                                            {day.wins} win{day.wins !== 1 ? 's' : ''}, {day.losses} loss{day.losses !== 1 ? 'es' : ''}
                                            {day.wins === 0 && day.losses === 0 && ' • Breakeven'}
                                        </p>
                                    )}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                                    <div className="w-2 h-2 bg-black/95 border-r border-b border-white/20 transform rotate-45 -translate-y-1/2" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
