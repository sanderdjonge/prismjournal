import { withAuth } from '@/lib/api/withAuth';
import { ok, created, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { validateBody, createAccountSchema } from '@/lib/validations';
import { initializeChallengePhases } from '@/lib/prop-firm/challenge-service';

export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id;

    const accounts = await prisma.tradingAccount.findMany({
        where: { userId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        include: { 
            _count: { select: { trades: true } },
            propFirm: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    challengeType: true,
                    dailyLossLimit: true,
                    maxDrawdown: true,
                    drawdownType: true,
                    phasesConfig: true,
                },
            },
        },
    });

    const accountsWithStats = await Promise.all(
        accounts.map(async (account) => {
            const stats = await prisma.trade.aggregate({
                where: { accountId: account.id, status: 'CLOSED' },
                _sum: { pnl: true },
                _count: true,
            });
            return {
                ...account,
                tradeCount: account._count.trades,
                closedTradeCount: stats._count,
                totalPnl: stats._sum?.pnl ?? 0,
            };
        })
    );

    return ok({ accounts: accountsWithStats });
});

export const POST = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;

    const validation = await validateBody(req, createAccountSchema);
    if (!validation.success) return validation.response;

    const data = validation.data;

    if (data.platformAccountId) {
        const existing = await prisma.tradingAccount.findFirst({
            where: { userId, platform: data.platform, platformAccountId: data.platformAccountId },
        });
        if (existing) return badRequest('Account with this platform ID already exists');
    }

    // If prop firm is selected, get the firm's default settings
    let propFirmDefaults = null;
    if (data.propFirmId) {
        propFirmDefaults = await prisma.propFirm.findUnique({
            where: { id: data.propFirmId },
        });
        if (!propFirmDefaults) return badRequest('Prop firm not found');
    }

    const account = await prisma.tradingAccount.create({
        data: {
            userId,
            name: data.name,
            broker: data.broker,
            accountNumber: data.accountNumber ?? data.platformAccountId,
            platform: data.platform,
            platformAccountId: data.platformAccountId,
            currency: data.currency,
            leverage: data.leverage,
            accountType: data.accountType,
            // Prop firm fields
            propFirmId: data.propFirmId,
            accountSize: data.accountSize,
            profitSplit: data.profitSplit,
            // Use prop firm defaults if not specified
            allowNewsTrading: data.allowNewsTrading ?? propFirmDefaults?.allowNewsTrading,
            allowWeekendHolding: data.allowWeekendHolding ?? propFirmDefaults?.allowWeekendHolding,
            allowEA: data.allowEA ?? propFirmDefaults?.allowEA,
        },
        include: {
            propFirm: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    challengeType: true,
                    dailyLossLimit: true,
                    maxDrawdown: true,
                    drawdownType: true,
                    phasesConfig: true,
                },
            },
        },
    });

    // Initialize challenge phases if this is a prop firm account
    if (data.propFirmId && data.accountSize) {
        try {
            await initializeChallengePhases(account.id, data.propFirmId, data.accountSize);
        } catch (error) {
            console.error('Failed to initialize challenge phases:', error);
            // Don't fail the request, just log the error
        }
    }

    return created({ account });
});

export const runtime = 'nodejs';
