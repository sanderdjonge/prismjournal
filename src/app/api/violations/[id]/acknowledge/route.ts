import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';

// Acknowledge a rule violation
export const POST = withAuth(async (req, ctx, session) => {
    const userId = session.user.id;
    const params = ctx.params as { id: string };
    const violationId = params.id;

    // Parse request body
    let body: { acknowledged: boolean; notes?: string };
    try {
        body = await req.json();
    } catch {
        return badRequest('Invalid request body');
    }

    if (!body.acknowledged) {
        return badRequest('Acknowledgment must be true');
    }

    // Get the violation and verify it belongs to user's account
    const violation = await (prisma as any).ruleViolation.findUnique({
        where: { id: violationId },
        include: {
            account: {
                select: {
                    userId: true,
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!violation) {
        return notFound('Violation not found');
    }

    if (violation.account.userId !== userId) {
        return notFound('Violation not found');
    }

    // Update the violation
    const updated = await (prisma as any).ruleViolation.update({
        where: { id: violationId },
        data: {
            isResolved: true,
            resolvedAt: new Date(),
            resolutionNotes: body.notes || 'User acknowledged the violation',
        },
    });

    return ok({
        success: true,
        violation: updated,
        message: 'Violation acknowledged successfully',
    });
});
