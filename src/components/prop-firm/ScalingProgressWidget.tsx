/**
 * Scaling Plan Progress Widget
 *
 * Displays progress through a prop firm's scaling plan.
 * Explains what scaling plans are and shows current level.
 */

'use client';

import React from 'react';
import { TrendingUp, HelpCircle, CheckCircle2, Circle } from 'lucide-react';
import { formatPercent, fmtDecimals } from '@/lib/formatNumber';

interface ScalingLevel {
    level: number;
    targetProfit: number; // % profit needed
    accountIncrease: number; // % account increase
    durationMonths: number;
    achieved?: boolean;
    achievedAt?: Date;
}

interface ScalingProgressWidgetProps {
    scalingConfig: {
        levels: ScalingLevel[];
        maxLevel: number;
    } | null;
    currentProgress: number; // Current profit %
    accountSize: number;
    currentBalance: number;
}

export function ScalingProgressWidget({
    scalingConfig,
    currentProgress,
    accountSize,
    currentBalance,
}: ScalingProgressWidgetProps) {
    // If no scaling config, show explanation
    if (!scalingConfig || !scalingConfig.levels?.length) {
        return (
            <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Scaling Plan</h3>
                </div>
                <div className="text-text-muted text-sm">
                    <p className="mb-2">
                        <strong className="text-white">What is a Scaling Plan?</strong>
                    </p>
                    <p className="mb-3">
                        A scaling plan allows you to grow your trading account over time by meeting 
                        consistent performance targets. When you achieve the profit goals for a set 
                        period (typically 4 months), the prop firm increases your account size by a 
                        percentage (e.g., 25%).
                    </p>
                    <p className="text-xs text-text-muted">
                        This prop firm does not have a scaling plan configured, or you are not yet 
                        on a funded account.
                    </p>
                </div>
            </div>
        );
    }

    // Calculate current level based on progress
    const levels = scalingConfig.levels;
    let currentLevel = 0;
    let nextLevel: ScalingLevel | null = null;

    for (let i = 0; i < levels.length; i++) {
        if (currentProgress >= levels[i].targetProfit) {
            currentLevel = levels[i].level;
        } else {
            nextLevel = levels[i];
            break;
        }
    }

    // Calculate next level info
    const progressToNext = nextLevel
        ? ((currentProgress / nextLevel.targetProfit) * 100)
        : 100;

    // Calculate account size after scaling
    const scaledAccountSize = currentLevel > 0
        ? accountSize * (1 + (levels[currentLevel - 1]?.accountIncrease || 0) / 100)
        : accountSize;

    return (
        <div className="glass-card border-border-color bg-surface-elevated backdrop-blur-xl rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Scaling Plan Progress</h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted">
                    <HelpCircle className="w-3 h-3" />
                    <span>Level {currentLevel} of {scalingConfig.maxLevel}</span>
                </div>
            </div>

            {/* Explanation */}
            <div className="mb-6 p-3 bg-surface-elevated rounded-lg text-sm text-text-muted">
                <strong className="text-white">Scaling Plan:</strong> Meet consistent profit targets 
                to grow your account. Each level increases your account size by the specified percentage.
            </div>

            {/* Current Progress */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-text-muted">
                        {nextLevel ? `Progress to Level ${nextLevel.level}` : 'Max Level Reached!'}
                    </span>
                    <span className="text-sm font-medium text-white">
                        {formatPercent(currentProgress, 1)} / {nextLevel?.targetProfit || 0}%
                    </span>
                </div>
                <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progressToNext, 100)}%` }}
                    />
                </div>
            </div>

            {/* Level Progression */}
            <div className="space-y-3">
                {levels.map((level, index) => {
                    const isAchieved = level.level <= currentLevel;
                    const isCurrent = level.level === currentLevel + 1;
                    
                    return (
                        <div 
                            key={level.level}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                                isAchieved ? 'bg-green-500/10' : isCurrent ? 'bg-indigo-500/10' : 'bg-surface-elevated'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {isAchieved ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : (
                                    <Circle className={`w-5 h-5 ${isCurrent ? 'text-indigo-400' : 'text-text-muted'}`} />
                                )}
                                <div>
                                    <div className={`text-sm font-medium ${isAchieved ? 'text-green-400' : 'text-white'}`}>
                                        Level {level.level}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        +{level.accountIncrease}% account • {level.durationMonths} months
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-white">
                                    {level.targetProfit}% profit
                                </div>
                                {isAchieved && (
                                    <div className="text-xs text-green-400">Achieved</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Account Size Info */}
            <div className="mt-6 pt-4 border-t border-border-color">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-text-muted uppercase tracking-wider">Original Size</div>
                        <div className="text-lg font-bold text-white">${fmtDecimals(accountSize, 2)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-text-muted uppercase tracking-wider">
                            {currentLevel > 0 ? 'Scaled Size' : 'Target After Level 1'}
                        </div>
                        <div className="text-lg font-bold text-green-400">
                            ${fmtDecimals(scaledAccountSize, 2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ScalingProgressWidget;