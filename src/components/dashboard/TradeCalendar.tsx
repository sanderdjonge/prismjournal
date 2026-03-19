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

type DayCell = {
    date: number;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
} | null;

type Week = DayCell[];

export default function TradeCalendar({ data }: TradeCalendarProps) {
    const { symbol } = useCurrency();
    const today = dayjs();
    const startOfMonth = today.startOf('month');
    const daysInMonth = today.daysInMonth();
    const startDay = startOfMonth.day(); // 0 (Sun) to 6 (Sat)

    // Build flat array of cells (nulls for padding + day objects)
    const flatCells: DayCell[] = [];
    for (let i = 0; i < startDay; i++) flatCells.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = startOfMonth.date(i).format('YYYY-MM-DD');
        const dayData = data.find(d => d.date === dateStr);
        flatCells.push({
            date: i,
            pnl: dayData?.pnl ?? 0,
            trades: dayData?.trades ?? 0,
            wins: dayData?.wins ?? 0,
            losses: dayData?.losses ?? 0,
        });
    }

    // Pad to full weeks
    while (flatCells.length % 7 !== 0) flatCells.push(null);

    // Split into weeks
    const weeks: Week[] = [];
    for (let i = 0; i < flatCells.length; i += 7) {
        weeks.push(flatCells.slice(i, i + 7));
    }

    // Monthly totals
    const monthlyPnl = data.reduce((s, d) => s + d.pnl, 0);
    const monthlyTrades = data.reduce((s, d) => s + d.trades, 0);
    const monthlyWins = data.reduce((s, d) => s + d.wins, 0);
    const monthlyLosses = data.reduce((s, d) => s + d.losses, 0);
    const monthlyWinRate = monthlyTrades > 0 ? Math.round((monthlyWins / monthlyTrades) * 100) : 0;

    const getPnlStyle = (pnl: number, hasTrades: boolean) => {
        if (!hasTrades) return {
            bg: "bg-white/5 hover:bg-white/10",
            border: "border-white/5",
            text: "text-gray-500",
        };
        if (pnl > 0) return {
            bg: "bg-profit/15 hover:bg-profit/25",
            border: "border-profit/30",
            text: "text-profit",
        };
        if (pnl < 0) return {
            bg: "bg-loss/15 hover:bg-loss/25",
            border: "border-loss/30",
            text: "text-loss",
        };
        return {
            bg: "bg-secondary/15 hover:bg-secondary/25",
            border: "border-secondary/30",
            text: "text-secondary",
        };
    };

    const pnlColor = (pnl: number) =>
        pnl > 0 ? 'text-profit' : pnl < 0 ? 'text-loss' : 'text-gray-400';

    return (
        <div className="p-5 h-full flex flex-col group/calendar overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
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
                        <div className="w-1.5 h-1.5 rounded-full bg-profit" />
                        <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Profits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-loss" />
                        <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Losses</span>
                    </div>
                </div>
            </div>

            {/* Calendar Grid — 8 columns: 7 days + weekly summary */}
            <div className="flex-1 min-h-0 flex flex-col gap-1">
                {/* Column headers — 9 cols: 7 days + spacer + weekly */}
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1 shrink-0">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                        <div key={d} className="text-center text-[10px] font-black text-gray-600 pb-1 tracking-tighter">
                            {d}
                        </div>
                    ))}
                    {/* spacer */}
                    <div />
                    <div className="text-center text-[10px] font-black text-gray-500 pb-1 tracking-tighter">
                        WEEK
                    </div>
                </div>

                {/* Week rows */}
                <div className="flex-1 min-h-0 flex flex-col gap-1">
                    {weeks.map((week, wi) => {
                        const weekDays = week.filter(Boolean) as NonNullable<DayCell>[];
                        const weekPnl = weekDays.reduce((s, d) => s + d.pnl, 0);
                        const weekTrades = weekDays.reduce((s, d) => s + d.trades, 0);
                        const weekWins = weekDays.reduce((s, d) => s + d.wins, 0);
                        const weekLosses = weekDays.reduce((s, d) => s + d.losses, 0);
                        const weekWinRate = weekTrades > 0 ? Math.round((weekWins / weekTrades) * 100) : null;

                        return (
                            <div key={wi} className="grid grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1 flex-1 min-h-0">
                                {/* 7 day cells */}
                                {week.map((day, di) => {
                                    if (!day) return <div key={`empty-${wi}-${di}`} />;
                                    const style = getPnlStyle(day.pnl, day.trades > 0);

                                    return (
                                        <div
                                            key={di}
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
                                                            <span className="text-[8px] font-black text-profit">{day.wins}W</span>
                                                        )}
                                                        {day.losses > 0 && (
                                                            <span className="text-[8px] font-black text-loss">{day.losses}L</span>
                                                        )}
                                                        {day.wins === 0 && day.losses === 0 && (
                                                            <span className="text-[8px] font-black text-secondary">BE</span>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/day:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                                                <div className="bg-black/95 border border-white/20 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                                    <p className="text-[10px] font-bold text-white">{startOfMonth.date(day.date).format('MMM D, YYYY')}</p>
                                                    <p className={cn("text-xs font-black mt-1", style.text)}>
                                                        {day.trades === 0 ? 'No trades' : `${day.trades} trade${day.trades > 1 ? 's' : ''} • ${day.pnl > 0 ? '+' : ''}${symbol}${Math.abs(day.pnl).toFixed(2)}`}
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

                                {/* Spacer column */}
                                <div />

                                {/* Weekly summary cell */}
                                <div className={cn(
                                    "rounded-lg flex flex-col items-center justify-center border min-h-0 px-1",
                                    weekTrades > 0
                                        ? weekPnl > 0
                                            ? "bg-profit/10 border-profit/20"
                                            : weekPnl < 0
                                                ? "bg-loss/10 border-loss/20"
                                                : "bg-secondary/10 border-secondary/20"
                                        : "bg-white/[0.03] border-white/5"
                                )}>
                                    {weekTrades > 0 ? (
                                        <>
                                            <span className={cn("text-[12px] font-black leading-tight", pnlColor(weekPnl))}>
                                                {weekPnl > 0 ? '+' : ''}{symbol}{Math.abs(weekPnl).toFixed(0)}
                                            </span>
                                            <span className="text-[9px] font-black text-gray-400 mt-0.5">
                                                {weekTrades}T
                                            </span>
                                            <div className="flex gap-0.5 mt-0.5">
                                                {weekWins > 0 && <span className="text-[8px] font-black text-profit">{weekWins}W</span>}
                                                {weekWins > 0 && weekLosses > 0 && <span className="text-[8px] text-gray-600">/</span>}
                                                {weekLosses > 0 && <span className="text-[8px] font-black text-loss">{weekLosses}L</span>}
                                            </div>
                                            {weekWinRate !== null && (
                                                <span className={cn("text-[8px] font-black mt-0.5", weekWinRate >= 50 ? "text-profit" : "text-loss")}>
                                                    {weekWinRate}%
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-[9px] text-gray-700 font-bold">—</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Monthly summary footer */}
                <div className="shrink-0 mt-1 grid grid-cols-[repeat(7,minmax(0,1fr))_12px_minmax(0,1.3fr)] gap-1">
                    {/* Spacer for 7 day columns + separator */}
                    <div className="col-span-7" />
                    <div />
                    {/* Monthly total cell */}
                    <div className={cn(
                        "rounded-lg flex flex-col items-center justify-center border py-2 px-1",
                        monthlyTrades > 0
                            ? monthlyPnl > 0
                                ? "bg-profit/15 border-profit/30"
                                : monthlyPnl < 0
                                    ? "bg-loss/15 border-loss/30"
                                    : "bg-secondary/15 border-secondary/30"
                            : "bg-white/[0.03] border-white/5"
                    )}>
                        <div className="text-[7px] font-black uppercase tracking-widest text-gray-600 mb-0.5">MTD</div>
                        {monthlyTrades > 0 ? (
                            <>
                                <span className={cn("text-[12px] font-black leading-tight", pnlColor(monthlyPnl))}>
                                    {monthlyPnl > 0 ? '+' : ''}{symbol}{Math.abs(monthlyPnl).toFixed(0)}
                                </span>
                                <span className="text-[9px] font-black text-gray-400 mt-0.5">
                                    {monthlyTrades}T
                                </span>
                                <div className="flex gap-0.5 mt-0.5">
                                    {monthlyWins > 0 && <span className="text-[8px] font-black text-profit">{monthlyWins}W</span>}
                                    {monthlyWins > 0 && monthlyLosses > 0 && <span className="text-[8px] text-gray-600">/</span>}
                                    {monthlyLosses > 0 && <span className="text-[8px] font-black text-loss">{monthlyLosses}L</span>}
                                </div>
                                <span className={cn("text-[8px] font-black mt-0.5", monthlyWinRate >= 50 ? "text-profit" : "text-loss")}>
                                    {monthlyWinRate}%
                                </span>
                            </>
                        ) : (
                            <span className="text-[9px] text-gray-700 font-bold">—</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
