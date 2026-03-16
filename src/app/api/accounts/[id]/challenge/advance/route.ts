import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';

interface AdvanceRequest {
    action: 'advance' | 'regress' | 'fail';
    targetPhase?: number;
    reason?: string;
    acknowledgment: boolean;
}

// Advance or modify challenge phase
export const POST = withAuth(async (req, ctx, session) => {
    const userId = session.user.id;
    const { id: accountId } = await (ctx.params as Promise<{ id: string }>);

    // Parse request body
    let body: AdvanceRequest;
    try {
        body = await req.json();
    } catch {
        return badRequest('Invalid request body');
    }

    if (!body.acknowledgment) {
        return badRequest('Acknowledgment required for phase changes');
    }

    // Verify account belongs to user
    const account = await prisma.tradingAccount.findFirst({
        where: { id: accountId, userId },
        include: {
            propFirm: {
                select: {
                    phasesConfig: true,
                },
            },
        },
    });

    if (!account) {
        return notFound('Account not found');
    }

    if (!account.propFirmId) {
        return badRequest('Account is not a prop firm account');
    }

    // Get current phases
    const phases = await (prisma as any).challengePhase.findMany({
        where: { accountId },
        orderBy: { phaseNumber: 'asc' },
    });

    const currentPhase = phases?.find((p: any) => p.status === 'IN_PROGRESS');

    if (!currentPhase) {
        return badRequest('No active challenge phase found');
    }

    const now = new Date();

    switch (body.action) {
        case 'advance': {
            // Mark current phase as passed
            await (prisma as any).challengePhase.update({
                where: { id: currentPhase.id },
                data: {
                    status: 'PASSED',
                    completedAt: now,
                },
            });

            // Find next phase
            const nextPhase = phases?.find((p: any) => p.phaseNumber === currentPhase.phaseNumber + 1);

            if (nextPhase) {
                // Activate next phase
                await (prisma as any).challengePhase.update({
                    where: { id: nextPhase.id },
                    data: {
                        status: 'IN_PROGRESS',
                        startedAt: now,
                    },
                });

                // Update account's current phase
                await prisma.tradingAccount.update({
                    where: { id: accountId },
                    data: { currentPhaseId: nextPhase.id },
                });
            } else {
                // No more phases - account is funded
                await prisma.tradingAccount.update({
                    where: { id: accountId },
                    data: {
                        currentPhase: 'Funded',
                        currentPhaseId: null,
                    },
                });
            }

            return ok({
                success: true,
                message: nextPhase 
                    ? `Advanced to ${nextPhase.phaseName}`
                    : 'Congratulations! Challenge completed - you are now funded!',
                previousPhase: currentPhase.phaseName,
                newPhase: nextPhase?.phaseName || 'Funded',
            });
        }

        case 'regress': {
            if (!body.targetPhase) {
                return badRequest('Target phase required for regression');
            }

            // Mark current phase as skipped
            await (prisma as any).challengePhase.update({
                where: { id: currentPhase.id },
                data: {
                    status: 'SKIPPED',
                },
            });

            // Find target phase
            const targetPhaseData = phases?.find((p: any) => p.phaseNumber === body.targetPhase);

            if (!targetPhaseData) {
                return badRequest('Target phase not found');
            }

            // Activate target phase
            await (prisma as any).challengePhase.update({
                where: { id: targetPhaseData.id },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: now,
                    tradingDaysCount: 0,
                    currentProgress: 0,
                    currentDrawdown: 0,
                },
            });

            await prisma.tradingAccount.update({
                where: { id: accountId },
                data: { currentPhaseId: targetPhaseData.id },
            });

            return ok({
                success: true,
                message: `Regressed to ${targetPhaseData.phaseName}`,
                previousPhase: currentPhase.phaseName,
                newPhase: targetPhaseData.phaseName,
            });
        }

        case 'fail': {
            // Mark current phase as failed
            await (prisma as any).challengePhase.update({
                where: { id: currentPhase.id },
                data: {
                    status: 'FAILED',
                    failedAt: now,
                    failureReason: body.reason || 'Manual failure acknowledgment',
                },
            });

            await prisma.tradingAccount.update({
                where: { id: accountId },
                data: {
                    isActive: false,
                    currentPhaseId: null,
                },
            });

            return ok({
                success: true,
                message: 'Challenge marked as failed',
                phase: currentPhase.phaseName,
                reason: body.reason,
            });
        }

        default:
            return badRequest('Invalid action');
    }
});
