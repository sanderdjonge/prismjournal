import prisma from './prisma';
import { auth } from './auth';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Returns the first active account for the authenticated user.
 * Creates a default account if none exists.
 * Returns null if no session — use getUserByBridgeKey for MT5 sync.
 */
export async function getDefaultAccount() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) return null;

    // Try to find existing account
    const existing = await prisma.tradingAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { id: 'asc' },
    });
    if (existing) return existing;

    // Create default account if none exists, guarding against concurrent creation
    try {
        return await prisma.tradingAccount.create({
            data: {
                userId,
                name: 'Default Account',
                broker: 'Manual',
                accountNumber: `MANUAL-${userId.slice(-8).toUpperCase()}`,
                currency: 'USD',
                leverage: 100,
                platform: 'METATRADER5',
                platformAccountId: `MANUAL-${userId.slice(-8).toUpperCase()}`,
            },
        });
    } catch (e: unknown) {
        // Another concurrent request already created the account (P2002 unique constraint)
        if ((e as { code?: string })?.code === 'P2002') {
            return prisma.tradingAccount.findFirst({
                where: { userId, isActive: true },
                orderBy: { id: 'asc' },
            });
        }
        throw e;
    }
}

/**
 * Returns the user and their accounts matching a bridge key (for MT5 sync endpoint).
 * Supports both hashed keys (new) and plain-text keys (legacy).
 * 
 * With multi-account support, the bridge key is now on the User model.
 * The platform + platformAccountId in the sync payload determines which account to use.
 */
export async function getUserByBridgeKey(bridgeKey: string) {
    const keyId = bridgeKey.slice(0, 12);

    // Try hashed lookup first (users that have been regenerated)
    const userByHash = await prisma.user.findFirst({
        where: { bridgeKeyId: keyId },
        include: { accounts: { where: { isActive: true } } },
    });

    if (userByHash?.bridgeKeyHash) {
        const valid = await bcrypt.compare(bridgeKey, userByHash.bridgeKeyHash);
        if (!valid) return null;
        // Lazy rehash: upgrade cost-10 hashes to cost-8 for faster sync
        if (bcrypt.getRounds(userByHash.bridgeKeyHash) > 8) {
            const newHash = bcrypt.hashSync(bridgeKey, 8);
            await prisma.user.update({
                where: { id: userByHash.id },
                data: { bridgeKeyHash: newHash },
            });
        }
        return userByHash;
    }

    return null;
}

/**
 * Get a specific trading account by platform and platformAccountId for a user.
 * Used by the sync endpoint to route trades to the correct account.
 */
export async function getAccountByPlatformId(
    userId: string,
    platform: string,
    platformAccountId: string
) {
    return prisma.tradingAccount.findFirst({
        where: {
            userId,
            platform: platform as 'METATRADER5' | 'CTRADER' | 'TRADINGVIEW' | 'MANUAL',
            platformAccountId,
            isActive: true,
        },
    });
}

/**
 * Generate a new bridge key, returning the plaintext key (show once),
 * the keyId (first 12 chars for lookup), and the bcrypt hash.
 */
export function generateBridgeKey() {
    const key = `prism_${randomBytes(24).toString('hex')}`;
    const keyId = key.slice(0, 12);
    const keyHash = bcrypt.hashSync(key, 8);
    return { key, keyId, keyHash };
}

/**
 * Get all active trading accounts for a user by their user ID.
 * Used by APIs that need to aggregate data across all accounts.
 */
export async function getAllUserAccounts(userId: string) {
    return prisma.tradingAccount.findMany({
        where: {
            userId,
            isActive: true,
        },
        orderBy: { createdAt: 'asc' },
    });
}
