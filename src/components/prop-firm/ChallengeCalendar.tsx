/**
 * Challenge Calendar Widget (Compact)
 *
 * Compact calendar showing daily P&L vs limits for prop firm challenge tracking.
 * Green days = profit, Red days = loss, Yellow = approaching limit
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface DailyData {
    date: string; // YYYY-MM-DD
    pnl: number;
    pnlPercent: number;
    dailyLossUsedPercent: number;
    isLimitBreached: boolean;
    tradeCount: number;
    isApproachingLimit?: boolean;
}

interface ChallengeCalendarProps {
    dailyData: DailyData[];
    dailyLossLimit: number;
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
    const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);

    const monthStart = dayjs(currentMonth).startOf('month');
    const daysInMonth = monthStart.daysInMonth();
    const startDay = monthStart.isoWeekday(); // 1 = Monday

    // Create data map
    const dataMap = useMemo(() => {
        const map = new Map<string, DailyData>();
        dailyData.forEach(d => map.set(d.date, d));
        return map;
    }, [dailyData]);

    // Month stats
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

    // Generate calendar days
    const calendarDays: Array<{ day: number | null; date: string; data: DailyData | null }> = [];
    
    // Add empty cells for days before month start
    for (let i = 1; i < startDay; i++) {
        calendarDays.push({ day: null, date: '', data: null });
    }
    
    // Add days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = monthStart.date(day).format('YYYY-MM-DD');
        calendarDays.push({ day, date, data: dataMap.get(date) || null });
    }

    const getCellStyle = (data: DailyData | null): { bg: string; border: string; text: string } => {
        if (!data) return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400' };
        
        if (data.isLimitBreached) {
            return { bg: 'bg-red-500/30', border: 'border-red-500/50', text: 'text-red-300' };
        }
        if (data.isApproachingLimit) {
            return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-300' };
        }
        if (data.pnl > 0) {
            return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' };
        }
        if (data.pnl < 0) {
            return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400' };
        }
        return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400' };
    };

    return (
        <div className="space-y-1">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').toDate())}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <div className="text-center">
                    <h3 className="text-xs font-bold text-white">{monthStart.format('MMMM YYYY')}</h3>
                    <div className="flex items-center justify-center gap-2 text-[10px] mt-0.5">
                        <span className="text-green-400">{monthStats.winDays} win {monthStats.winDays === 1 ? 'day' : 'days'}</span>
                        <span className="text-gray-600">·</span>
                        <span className="text-red-400">{monthStats.lossDays} loss {monthStats.lossDays === 1 ? 'day' : 'days'}</span>
                        <span className="text-gray-600">·</span>
                        <span className={monthStats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {monthStats.pnl >= 0 ? '+' : ''}${monthStats.pnl.toFixed(0)} profit
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setCurrentMonth(dayjs(currentMonth).add(1, 'month').toDate())}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="text-center text-[10px] text-gray-500 font-medium py-0.5">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid - All weeks */}
            <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((cell, index) => {
                    if (cell.day === null) {
                        return <div key={`empty-${index}`} className="h-9" />;
                    }

                    const isToday = cell.date === dayjs().format('YYYY-MM-DD');
                    const isSelected = selectedDay?.date === cell.date;
                    const style = getCellStyle(cell.data);

                    return (
                        <button
                            key={cell.date}
                            onClick={() => setSelectedDay(cell.data ?? { date: cell.date, pnl: 0, pnlPercent: 0, dailyLossUsedPercent: 0, isLimitBreached: false, tradeCount: 0 })}
                            className={`
                                h-9 flex flex-col items-center justify-center rounded border transition-all
                                ${style.bg} ${style.border} ${style.text}
                                ${isToday ? 'ring-1 ring-indigo-500' : ''}
                                ${isSelected ? 'ring-1 ring-white' : ''}
                                hover:opacity-80 cursor-pointer
                            `}
                            title={cell.data ? `$${cell.data.pnl.toFixed(2)} (${cell.data.pnlPercent.toFixed(1)}%)` : 'No trades'}
                        >
                            <span className="text-xs font-medium leading-none">{cell.day}</span>
                            {cell.data && (
                                <span className="text-[10px] font-bold leading-none mt-0.5">
                                    {cell.data.pnl >= 0 ? '+' : ''}{cell.data.pnlPercent.toFixed(1)}%
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-green-500/20 border border-green-500/40" />
                    <span>Profit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500/15 border border-red-500/40" />
                    <span>Loss</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/20 border border-yellow-500/50" />
                    <span>Near Limit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/50" />
                    <span>Breached</span>
                </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDay && (
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-white">
                            {dayjs(selectedDay.date).format('dddd, MMM D')}
                        </h4>
                        <button
                            onClick={() => setSelectedDay(null)}
                            className="text-gray-500 hover:text-white text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    {selectedDay.tradeCount === 0 && selectedDay.pnl === 0 && !dailyData.find(d => d.date === selectedDay.date) ? (
                        <p className="text-xs text-gray-500">No trades recorded on this day.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-gray-500">Daily P&L:</span>
                                    <span className={`ml-1 font-bold ${selectedDay.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {selectedDay.pnl >= 0 ? '+' : ''}${selectedDay.pnl.toFixed(2)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Daily loss used:</span>
                                    <span className={`ml-1 font-bold ${selectedDay.dailyLossUsedPercent > 80 ? 'text-yellow-400' : 'text-white'}`}>
                                        {selectedDay.dailyLossUsedPercent.toFixed(0)}% of limit
                                    </span>
                                </div>
                            </div>
                            {selectedDay.isApproachingLimit && !selectedDay.isLimitBreached && (
                                <div className="flex items-center gap-1 text-yellow-400 text-xs mt-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Approaching daily loss limit</span>
                                </div>
                            )}
                            {selectedDay.isLimitBreached && (
                                <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Daily loss limit breached</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default ChallengeCalendar;