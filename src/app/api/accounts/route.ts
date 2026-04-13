import { withAuth } from '@/lib/api/withAuth';
import { ok, created, badRequest } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { validateBody, createAccountSchema } from '@/lib/validations';
import { initializeChallengePhases } from '@/lib/prop-firm/challenge-service';
import logger from '@/lib/logger';

export const GET = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;
    
    // Check if we should include archived accounts
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get('includeArchived') === 'true';

    const accounts = await prisma.tradingAccount.findMany({
        where: {
            userId,
            ...(includeArchived ? {} : { isActive: true }),
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        include: {
            _count: { select: { trades: true } },
            challengePhases: {
                select: { phaseName: true, status: true },
            },
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
            dailySnapshots: {
                orderBy: { snapshotDate: 'desc' as const },
                take: 1,
                select: { highWaterMark: true },
            },
        },
    });

    const tradeSummaries = await prisma.trade.groupBy({
        by: ['accountId'],
        where: {
            accountId: { in: accounts.map(a => a.id) },
            status: 'CLOSED',
        },
        _sum: { pnl: true },
        _count: { id: true },
    });

    const summaryMap = new Map(tradeSummaries.map(s => [s.accountId, s]));
    const accountsWithStats = accounts.map((account) => {
        const summary = summaryMap.get(account.id);
        const currentPhase = account.challengePhases?.find(p => p.status === 'IN_PROGRESS')?.phaseName ?? null;
        return {
            ...account,
            currentPhase,
            tradeCount: account._count.trades,
            closedTradeCount: summary?._count?.id ?? 0,
            totalPnl: summary?._sum?.pnl ?? 0,
            highWaterMark: account.dailySnapshots[0]?.highWaterMark ?? account.accountSize,
        };
    });

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
            logger.error({ err: error }, 'Failed to initialize challenge phases');
            // Don't fail the request, just log the error
        }
    }

    return created({ account });
});

export const runtime = 'nodejs';
