import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notifyRuleViolation } from '@/lib/notifications';
import { updateTradingDaysCount, autoAdvancePhaseIfNeeded } from '@/lib/prop-firm/challenge-service';

/**
 * Daily Snapshot Cron Job
 *
 * This endpoint should be called by a cron scheduler (e.g., Vercel Cron, GitHub Actions, or external cron service)
 * It creates daily snapshots for all active prop firm accounts and checks for rule violations.
 *
 * Recommended schedule: Run daily at 00:05 UTC (after midnight to capture previous day's data)
 *
 * Security: Should be protected by a cron secret header
 */

export async function GET(request: NextRequest) {
    // Verify cron secret for security
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Fix 4: fail-closed — reject if either secret is missing or they don't match
    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const snapshotDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        // Update trading days count for all active prop firm accounts (Fix 3)
        await updateTradingDaysCount();

        // Get all active prop firm accounts
        const accounts = await prisma.tradingAccount.findMany({
            where: {
                isActive: true,
                propFirmId: { not: null },
            },
            include: {
                propFirm: {
                    select: {
                        dailyLossLimit: true,
                        maxDrawdown: true,
                        drawdownType: true,
                        phasesConfig: true,
                    },
                },
            },
        });

        const results = {
            snapshotsCreated: 0,
            violationsDetected: 0,
            accountsProcessed: 0,
            errors: [] as string[],
        };

        for (const account of accounts) {
            try {
                if (!account.propFirm) continue;

                // Get trades from yesterday
                const dayStart = new Date(yesterday);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(yesterday);
                dayEnd.setHours(23, 59, 59, 999);

                const trades = await prisma.trade.findMany({
                    where: {
                        accountId: account.id,
                        status: 'CLOSED',
                        exitTime: {
                            gte: dayStart,
                            lte: dayEnd,
                        },
                    },
                });

                // Calculate daily P&L
                const dailyPnl = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
                const accountSize = account.accountSize || 10000;
                const startingBalance = account.balance || accountSize;
                const currentBalance = account.currentBalance || startingBalance;
                const currentEquity = account.currentEquity || currentBalance;

                // Calculate daily P&L percentage
                const dailyPnlPercent = (dailyPnl / startingBalance) * 100;

                // Calculate drawdown
                const highWaterMark = Math.max(startingBalance, currentBalance);
                const currentDrawdown = Math.max(0, ((highWaterMark - currentEquity) / startingBalance) * 100);

                // Fix 1: only count a loss when dailyPnl is actually negative
                const dailyLossLimit = account.propFirm.dailyLossLimit;
                const dailyLossUsed = dailyPnl < 0 ? (Math.abs(dailyPnl) / startingBalance) * 100 : 0;
                const dailyLossPercentOfLimit = (dailyLossUsed / dailyLossLimit) * 100;

                // Check for violations
                const isDailyLimitBreached = dailyLossUsed >= dailyLossLimit;
                const isMaxDrawdownBreached = currentDrawdown >= account.propFirm.maxDrawdown;

                // Calculate profit progress
                const profitProgress = ((currentBalance - startingBalance) / startingBalance) * 100;

                // Check if snapshot already exists for this date
                // Fix 5: use prisma.dailyAccountSnapshot instead of (prisma as any).dailyAccountSnapshot
                const existingSnapshot = await prisma.dailyAccountSnapshot.findUnique({
                    where: {
                        accountId_snapshotDate: {
                            accountId: account.id,
                            snapshotDate: yesterday,
                        },
                    },
                });

                if (!existingSnapshot) {
                    // Create daily snapshot
                    // Fix 5: use prisma.dailyAccountSnapshot instead of (prisma as any).dailyAccountSnapshot
                    await prisma.dailyAccountSnapshot.create({
                        data: {
                            accountId: account.id,
                            snapshotDate: yesterday,
                            startingBalance,
                            endingBalance: currentBalance,
                            endingEquity: currentEquity,
                            dailyPnl,
                            dailyPnlPercent,
                            currentDrawdown,
                            maxDrawdown: currentDrawdown, // Track max drawdown reached
                            highWaterMark,
                            dailyLossUsed: dailyLossPercentOfLimit,
                            isDailyLimitBreached,
                            isMaxDrawdownBreached,
                            profitProgress,
                        },
                    });
                    results.snapshotsCreated++;

                    // Fix 2: violation creation moved inside !existingSnapshot guard to prevent duplicates on re-runs

                    // Create violations if limits breached
                    if (isDailyLimitBreached) {
                        // Fix 5: use prisma.ruleViolation instead of (prisma as any).ruleViolation
                        const violation = await prisma.ruleViolation.create({
                            data: {
                                accountId: account.id,
                                ruleType: 'DAILY_LOSS_LIMIT',
                                severity: 'BREACH',
                                limitValue: dailyLossLimit,
                                actualValue: dailyLossUsed,
                                description: `Daily loss limit breached: ${dailyLossUsed.toFixed(2)}% used of ${dailyLossLimit}% limit`,
                            },
                        });
                        results.violationsDetected++;

                        // Send notification
                        await notifyRuleViolation(account.userId, {
                            accountName: account.name,
                            ruleType: 'DAILY_LOSS_LIMIT',
                            severity: 'BREACH',
                            description: violation.description,
                            accountId: account.id,
                            violationId: violation.id,
                        });
                    }

                    if (isMaxDrawdownBreached) {
                        // Fix 5: use prisma.ruleViolation instead of (prisma as any).ruleViolation
                        const violation = await prisma.ruleViolation.create({
                            data: {
                                accountId: account.id,
                                ruleType: 'MAX_DRAWDOWN',
                                severity: 'BREACH',
                                limitValue: account.propFirm.maxDrawdown,
                                actualValue: currentDrawdown,
                                description: `Max drawdown breached: ${currentDrawdown.toFixed(2)}% of ${account.propFirm.maxDrawdown}% limit`,
                            },
                        });
                        results.violationsDetected++;

                        // Send notification
                        await notifyRuleViolation(account.userId, {
                            accountName: account.name,
                            ruleType: 'MAX_DRAWDOWN',
                            severity: 'BREACH',
                            description: violation.description,
                            accountId: account.id,
                            violationId: violation.id,
                        });
                    }

                    // Check for warning thresholds (80% of limit)
                    if (dailyLossPercentOfLimit >= 80 && !isDailyLimitBreached) {
                        // Fix 5: use prisma.ruleViolation instead of (prisma as any).ruleViolation
                        const violation = await prisma.ruleViolation.create({
                            data: {
                                accountId: account.id,
                                ruleType: 'DAILY_LOSS_LIMIT',
                                severity: 'WARNING',
                                limitValue: dailyLossLimit,
                                actualValue: dailyLossUsed,
                                description: `Approaching daily loss limit: ${dailyLossUsed.toFixed(2)}% used of ${dailyLossLimit}% limit`,
                            },
                        });
                        results.violationsDetected++;

                        // Send notification
                        await notifyRuleViolation(account.userId, {
                            accountName: account.name,
                            ruleType: 'DAILY_LOSS_LIMIT',
                            severity: 'WARNING',
                            description: violation.description,
                            accountId: account.id,
                            violationId: violation.id,
                        });
                    }

                    if (currentDrawdown >= account.propFirm.maxDrawdown * 0.8 && !isMaxDrawdownBreached) {
                        // Fix 5: use prisma.ruleViolation instead of (prisma as any).ruleViolation
                        const violation = await prisma.ruleViolation.create({
                            data: {
                                accountId: account.id,
                                ruleType: 'MAX_DRAWDOWN',
                                severity: 'WARNING',
                                limitValue: account.propFirm.maxDrawdown,
                                actualValue: currentDrawdown,
                                description: `Approaching max drawdown: ${currentDrawdown.toFixed(2)}% of ${account.propFirm.maxDrawdown}% limit`,
                            },
                        });
                        results.violationsDetected++;

                        // Send notification
                        await notifyRuleViolation(account.userId, {
                            accountName: account.name,
                            ruleType: 'MAX_DRAWDOWN',
                            severity: 'WARNING',
                            description: violation.description,
                            accountId: account.id,
                            violationId: violation.id,
                        });
                    }

                    // Fix 3: check and advance phase after snapshot is created
                    await autoAdvancePhaseIfNeeded(account.id);
                }

                results.accountsProcessed++;
            } catch (accountError) {
                results.errors.push(`Account ${account.id}: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            snapshotDate,
            results,
        });
    } catch (error) {
        console.error('Daily snapshot cron error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
