/**
 * Prop Firm Challenge Service
 * 
 * Handles automatic phase advancement detection and challenge progress tracking
 */

import prisma from '@/lib/prisma';

interface PhaseConfig {
    phaseNumber: number;
    phaseName: string;
    profitTarget: number;
    dailyLossLimit: number;
    maxDrawdown: number;
    minTradingDays?: number;
    timeLimitDays?: number;
}

interface AdvancementCheckResult {
    shouldAdvance: boolean;
    reason: string;
    currentProgress: number;
    targetProgress: number;
    minTradingDaysMet: boolean;
    tradingDaysCount: number;
    minTradingDaysRequired: number;
}

/**
 * Check if an account should automatically advance to the next phase
 */
export async function checkPhaseAdvancement(accountId: string): Promise<AdvancementCheckResult | null> {
    // Get account with current phase and prop firm config
    const account = await prisma.tradingAccount.findUnique({
        where: { id: accountId },
        include: {
            propFirm: {
                select: {
                    phasesConfig: true,
                    dailyLossLimit: true,
                    maxDrawdown: true,
                },
            },
        },
    });

    if (!account || !account.propFirmId || !account.propFirm) {
        return null;
    }

    // Get current active phase
    const currentPhase = await prisma.challengePhase.findFirst({
        where: {
            accountId,
            status: 'IN_PROGRESS',
        },
    });

    if (!currentPhase) {
        return null;
    }

    // Parse phases config
    let phasesConfig: PhaseConfig[] = [];
    try {
        phasesConfig = JSON.parse(account.propFirm.phasesConfig);
    } catch {
        return null;
    }

    // Get current phase config
    const phaseConfig = phasesConfig.find(p => p.phaseNumber === currentPhase.phaseNumber);
    if (!phaseConfig) {
        return null;
    }

    // Calculate current progress
    const accountSize = account.accountSize || 10000;
    const currentBalance = account.currentBalance || accountSize;
    const currentProgress = ((currentBalance - accountSize) / accountSize) * 100;

    // Check profit target
    const targetProgress = phaseConfig.profitTarget;
    const profitTargetReached = currentProgress >= targetProgress;

    // Check minimum trading days
    const minTradingDaysRequired = phaseConfig.minTradingDays || 0;
    const tradingDaysCount = currentPhase.tradingDaysCount || 0;
    const minTradingDaysMet = tradingDaysCount >= minTradingDaysRequired;

    // Determine if should advance
    const shouldAdvance = profitTargetReached && minTradingDaysMet;

    return {
        shouldAdvance,
        reason: shouldAdvance 
            ? 'Profit target reached and minimum trading days met'
            : profitTargetReached && !minTradingDaysMet
                ? `Profit target reached but need ${minTradingDaysRequired - tradingDaysCount} more trading days`
                : !profitTargetReached
                    ? `Progress: ${currentProgress.toFixed(2)}% / ${targetProgress}% target`
                    : 'Requirements not met',
        currentProgress,
        targetProgress,
        minTradingDaysMet,
        tradingDaysCount,
        minTradingDaysRequired,
    };
}

/**
 * Automatically advance phase if conditions are met
 */
export async function autoAdvancePhaseIfNeeded(accountId: string): Promise<{
    advanced: boolean;
    message: string;
    newPhase?: string;
}> {
    const check = await checkPhaseAdvancement(accountId);
    
    if (!check || !check.shouldAdvance) {
        return {
            advanced: false,
            message: check?.reason || 'No active phase found',
        };
    }

    // Get current phase
    const currentPhase = await prisma.challengePhase.findFirst({
        where: {
            accountId,
            status: 'IN_PROGRESS',
        },
    });

    if (!currentPhase) {
        return {
            advanced: false,
            message: 'No active phase found',
        };
    }

    // Get all phases
    const phases = await prisma.challengePhase.findMany({
        where: { accountId },
        orderBy: { phaseNumber: 'asc' },
    });

    const now = new Date();

    // Find next phase before entering transaction
    const nextPhase = phases.find((p) => p.phaseNumber === currentPhase.phaseNumber + 1);

    await prisma.$transaction(async (tx) => {
        // Mark current phase as passed
        await tx.challengePhase.update({
            where: { id: currentPhase.id },
            data: {
                status: 'PASSED',
                completedAt: now,
                currentProgress: check.currentProgress,
            },
        });

        if (nextPhase) {
            // Activate next phase
            await tx.challengePhase.update({
                where: { id: nextPhase.id },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: now,
                },
            });

            // Update account's current phase
            await tx.tradingAccount.update({
                where: { id: accountId },
                data: { currentPhaseId: nextPhase.id },
            });
        } else {
            // No more phases - account is funded
            await tx.tradingAccount.update({
                where: { id: accountId },
                data: {
                    currentPhase: 'Funded',
                    currentPhaseId: null,
                },
            });
        }
    });

    if (nextPhase) {
        return {
            advanced: true,
            message: `Congratulations! Advanced to ${nextPhase.phaseName}`,
            newPhase: nextPhase.phaseName,
        };
    } else {
        return {
            advanced: true,
            message: 'Congratulations! Challenge completed - you are now funded!',
            newPhase: 'Funded',
        };
    }
}

/**
 * Initialize challenge phases for a new prop firm account
 */
export async function initializeChallengePhases(
    accountId: string,
    propFirmId: string,
    accountSize: number
): Promise<void> {
    // Get prop firm config
    const propFirm = await prisma.propFirm.findUnique({
        where: { id: propFirmId },
    });

    if (!propFirm) {
        throw new Error('Prop firm not found');
    }

    // Parse phases config
    let phasesConfig: PhaseConfig[] = [];
    try {
        phasesConfig = JSON.parse(propFirm.phasesConfig);
    } catch {
        throw new Error('Invalid phases configuration');
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
        // Create phases
        for (let i = 0; i < phasesConfig.length; i++) {
            const config = phasesConfig[i];
            const isFirst = i === 0;

            await tx.challengePhase.create({
                data: {
                    accountId,
                    phaseNumber: config.phaseNumber,
                    phaseName: config.phaseName,
                    profitTarget: config.profitTarget,
                    profitTargetAmount: (accountSize * config.profitTarget) / 100,
                    dailyLossLimit: config.dailyLossLimit,
                    maxDrawdown: config.maxDrawdown,
                    minTradingDays: config.minTradingDays || null,
                    timeLimitDays: config.timeLimitDays || null,
                    status: isFirst ? 'IN_PROGRESS' : 'SKIPPED', // First phase active, others skipped until activated
                    startedAt: isFirst ? now : undefined,
                },
            });
        }

        // Set the first phase as current
        const firstPhase = await tx.challengePhase.findFirst({
            where: {
                accountId,
                phaseNumber: 1,
            },
        });

        if (firstPhase) {
            await tx.tradingAccount.update({
                where: { id: accountId },
                data: { currentPhaseId: firstPhase.id },
            });
        }
    });
}

/**
 * Update trading days count for all active prop firm accounts
 * Should be called daily by the cron job
 */
export async function updateTradingDaysCount(): Promise<void> {
    // Get all active prop firm accounts with an active phase
    const accounts = await prisma.tradingAccount.findMany({
        where: {
            isActive: true,
            propFirmId: { not: null },
            currentPhaseId: { not: null },
        },
    });

    for (const account of accounts) {
        if (!account.currentPhaseId) continue;

        // Count trades from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tradesToday = await prisma.trade.count({
            where: {
                accountId: account.id,
                status: 'CLOSED',
                exitTime: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });

        // If there were trades today, increment trading days count
        if (tradesToday > 0) {
            await prisma.challengePhase.update({
                where: { id: account.currentPhaseId },
                data: {
                    tradingDaysCount: { increment: 1 },
                },
            });
        }
    }
}
