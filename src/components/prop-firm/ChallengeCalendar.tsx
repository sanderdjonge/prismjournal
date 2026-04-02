/**
 * Challenge Calendar Widget
 *
 * Calendar view showing daily P&L vs limits for prop firm challenge tracking.
 * Green days = profit, Red days = loss, Yellow border = approaching limit
 */

'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ChallengeCalendar({
    dailyData,
    dailyLossLimit,
    accountSize,
    currentMonth: initialMonth,
}: ChallengeCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date());
    const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);

    const monthStart = dayjs(currentMonth).startOf('month');
    const monthEnd = dayjs(currentMonth).endOf('month');
    const startDay = monthStart.isoWeekday(); // 1 = Monday
    const daysInMonth = monthEnd.date();

    // Create data map for quick lookup
    const dataMap = new Map<string, DailyData>();
    dailyData.forEach(d => dataMap.set(d.date, d));

    // Calculate month totals
    const monthData = dailyData.filter(d => {
        const date = dayjs(d.date);
        return date.month() === monthStart.month() && date.year() === monthStart.year();
    });
    const monthPnl = monthData.reduce((sum, d) => sum + d.pnl, 0);
    const tradingDays = monthData.length;

    const goToPrevMonth = () => {
        setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').toDate());
    };

    const goToNextMonth = () => {
        setCurrentMonth(dayjs(currentMonth).add(1, 'month').toDate());
    };

    const renderDay = (day: number | null, isCurrentMonth: boolean) => {
        if (day === null) {
            return (
                <div key={`empty-${Math.random()}`} className="aspect-square" />
            );
        }

        const date = monthStart.date(day).format('YYYY-MM-DD');
        const dayData = dataMap.get(date);
        const isToday = date === dayjs().format('YYYY-MM-DD');
        const isSelected = selectedDay?.date === date;

        // Determine styling
        let bgClass = 'bg-white/5';
        let borderClass = 'border-white/10';
        let textClass = 'text-gray-400';

        if (dayData) {
            if (dayData.isLimitBreached) {
                bgClass = 'bg-red-500/20';
                borderClass = 'border-red-500/50';
            } else if (dayData.isApproachingLimit) {
                bgClass = 'bg-yellow-500/10';
                borderClass = 'border-yellow-500/50';
            } else if (dayData.pnl > 0) {
                bgClass = 'bg-green-500/10';
                borderClass = 'border-green-500/30';
                textClass = 'text-green-400';
            } else if (dayData.pnl < 0) {
                bgClass = 'bg-red-500/10';
                borderClass = 'border-red-500/30';
                textClass = 'text-red-400';
            }
        }

        return (
            <button
                key={date}
                onClick={() => dayData && setSelectedDay(dayData)}
                className={`
                    aspect-square flex flex-col items-center justify-center rounded-lg border transition-all
                    ${bgClass} ${borderClass} ${textClass}
                    ${isToday ? 'ring-2 ring-indigo-500' : ''}
                    ${isSelected ? 'ring-2 ring-white' : ''}
                    hover:scale-105 cursor-pointer
                `}
            >
                <span className="text-xs font-medium">{day}</span>
                {dayData && (
                    <span className="text-[10px] font-bold">
                        {dayData.pnl >= 0 ? '+' : ''}{(dayData.pnlPercent).toFixed(1)}%
                    </span>
                )}
            </button>
        );
    };

    // Generate calendar grid
    const calendarDays: (number | null)[] = [];
    
    // Add empty cells for days before month start
    for (let i = 1; i < startDay; i++) {
        calendarDays.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    return (
        <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={goToPrevMonth}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <h3 className="text-lg font-bold text-white">
                    {monthStart.format('MMMM YYYY')}
                </h3>
                <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            {/* Month Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-lg">
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Month P&L</div>
                    <div className={`text-lg font-bold ${monthPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${monthPnl.toFixed(2)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Trading Days</div>
                    <div className="text-lg font-bold text-white">{tradingDays}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Daily Limit</div>
                    <div className="text-lg font-bold text-yellow-400">{dailyLossLimit}%</div>
                </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map(day => (
                    <div key={day} className="text-center text-xs text-gray-500 py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => renderDay(day, true))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
                    <span>Profit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/30" />
                    <span>Loss</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500/10 border border-yellow-500/50" />
                    <span>Near Limit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
                    <span>Limit Breached</span>
                </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDay && (
                <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-white">
                            {dayjs(selectedDay.date).format('dddd, MMMM D, YYYY')}
                        </h4>
                        {selectedDay.isApproachingLimit && !selectedDay.isLimitBreached && (
                            <div className="flex items-center gap-1 text-yellow-400 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Approaching Limit</span>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500">P&L:</span>
                            <span className={`ml-2 font-bold ${selectedDay.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${selectedDay.pnl.toFixed(2)}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500">Trades:</span>
                            <span className="ml-2 font-bold text-white">{selectedDay.tradeCount}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Daily Loss Used:</span>
                            <span className={`ml-2 font-bold ${selectedDay.dailyLossUsedPercent > 80 ? 'text-yellow-400' : 'text-white'}`}>
                                {selectedDay.dailyLossUsedPercent.toFixed(1)}%
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500">Limit:</span>
                            <span className="ml-2 font-bold text-white">
                                ${(accountSize * dailyLossLimit / 100).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChallengeCalendar;