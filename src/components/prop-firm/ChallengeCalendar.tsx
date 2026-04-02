/**
 * Challenge Calendar Widget (Compact)
 *
 * Calendar view showing daily P&L vs limits for prop firm challenge tracking.
 * Green days = profit, Red days = loss, Yellow = approaching limit
 * Similar compact style to dashboard TradeCalendar
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

interface DailyData {
    date: string; // YYYY-MM-DD
    pnl: number;
    pnlPercent: number;
    dailyLossUsedPercent: number;
    isLimitBreached: boolean;
    tradeCount: number;
    isApproachingLimit?: boolean; // > 80% of daily limit
}

interface ChallengeCalendarProps {
    dailyData: DailyData[];
    dailyLossLimit: number; // % of account
    accountSize: number;
    currentMonth?: Date;
}

export function ChallengeCalendar({
    dailyData,
    dailyLossLimit,
    accountSize,
    currentMonth: initialMonth,
}: ChallengeCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date());

    const monthStart = dayjs(currentMonth).startOf('month');
    const monthEnd = dayjs(currentMonth).endOf('month');
    const startDay = monthStart.isoWeekday(); // 1 = Monday
    const daysInMonth = monthEnd.date();

    // Create data map for quick lookup
    const dataMap = useMemo(() => {
        const map = new Map<string, DailyData>();
        dailyData.forEach(d => map.set(d.date, d));
        return map;
    }, [dailyData]);

    // Calculate month totals
    const monthStats = useMemo(() => {
        const monthData = dailyData.filter(d => {
            const date = dayjs(d.date);
            return date.month() === monthStart.month() && date.year() === monthStart.year();
        });
        return {
            pnl: monthData.reduce((sum, d) => sum + d.pnl, 0),
            days: monthData.length,
            winDays: monthData.filter(d => d.pnl > 0).length,
            lossDays: monthData.filter(d => d.pnl < 0).length,
        };
    }, [dailyData, monthStart]);

    const goToPrevMonth = () => {
        setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').toDate());
    };

    const goToNextMonth = () => {
        setCurrentMonth(dayjs(currentMonth).add(1, 'month').toDate());
    };

    // Generate calendar grid
    const calendarDays: (number | null)[] = [];
    for (let i = 1; i < startDay; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    // Helper to get background style based on P&L
    const getDayBg = (dayData: DailyData | undefined): React.CSSProperties => {
        if (!dayData) return { backgroundColor: 'rgba(255,255,255,0.03)' };
        
        if (dayData.isLimitBreached) {
            return { backgroundColor: 'rgba(239,68,68,0.4)' };
        }
        if (dayData.isApproachingLimit) {
            return { backgroundColor: 'rgba(234,179,8,0.3)' };
        }
        if (dayData.pnl > 0) {
            const intensity = Math.min(Math.abs(dayData.pnlPercent) / 5, 1);
            return { backgroundColor: `rgba(34,197,94,${0.2 + intensity * 0.3})` };
        }
        if (dayData.pnl < 0) {
            const intensity = Math.min(Math.abs(dayData.pnlPercent) / 5, 1);
            return { backgroundColor: `rgba(239,68,68,${0.15 + intensity * 0.25})` };
        }
        return { backgroundColor: 'rgba(255,255,255,0.05)' };
    };

    return (
        <div className="space-y-3">
            {/* Month Navigation & Summary */}
            <div className="flex items-center justify-between">
                <button
                    onClick={goToPrevMonth}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <div className="text-center">
                    <h3 className="text-sm font-bold text-white">
                        {monthStart.format('MMMM YYYY')}
                    </h3>
                    <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500 mt-0.5">
                        <span className="text-green-400">{monthStats.winDays}W</span>
                        <span className="text-red-400">{monthStats.lossDays}L</span>
                        <span className={monthStats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            ${monthStats.pnl.toFixed(0)}
                        </span>
                    </div>
                </div>
                <button
                    onClick={goToNextMonth}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-px">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-[9px] text-gray-500 font-black text-center py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px">
                {calendarDays.map((day, index) => {
                    if (day === null) {
                        return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const date = monthStart.date(day).format('YYYY-MM-DD');
                    const dayData = dataMap.get(date);
                    const isToday = date === dayjs().format('YYYY-MM-DD');
                    const hasData = dayData && (dayData.pnl !== 0 || dayData.tradeCount > 0);

                    return (
                        <div
                            key={date}
                            className="aspect-square rounded-sm flex items-center justify-center cursor-pointer hover:opacity-75 transition-opacity relative"
                            style={getDayBg(dayData)}
                            title={hasData ? `${dayData!.pnl >= 0 ? '+' : ''}$${dayData!.pnl.toFixed(2)} (${dayData!.pnlPercent.toFixed(1)}%)` : undefined}
                        >
                            <span className={`text-[9px] font-bold leading-none ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
                                {day}
                            </span>
                            {isToday && (
                                <div className="absolute inset-0 rounded-sm ring-1 ring-indigo-500/50" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[9px] text-gray-500">
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-green-500/30" />
                    <span>Profit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500/20" />
                    <span>Loss</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/30" />
                    <span>Near Limit</span>
                </div>
            </div>
        </div>
    );
}

export default ChallengeCalendar;