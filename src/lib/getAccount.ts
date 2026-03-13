import prisma from './prisma';
import { auth } from './auth';
import { randomBytes } from 'crypto';

/**
 * Returns the first active account for the authenticated user.
 * Creates a default account if none exists.
 * Returns null if no session — use getAccountByBridgeKey for MT5 sync.
 */
export async function getDefaultAccount() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) return null;

    // Try to find existing account
    let account = await prisma.tradingAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { id: 'asc' },
    });

    // Create default account if none exists
    if (!account) {
        account = await prisma.tradingAccount.create({
            data: {
                userId,
                name: 'Default Account',
                broker: 'Manual',
                accountNumber: `MANUAL-${userId.slice(-8).toUpperCase()}`,
                currency: 'USD',
                leverage: 100,
                bridgeKey: `prism_${randomBytes(24).toString('hex')}`,
            },
        });
    }

    return account;
}

/**
 * Returns the account matching a bridge key (for MT5 sync endpoint).
 */
export async function getAccountByBridgeKey(bridgeKey: string) {
    return prisma.tradingAccount.findFirst({
        where: { bridgeKey, isActive: true },
    });
}
