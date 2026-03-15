import prisma from './prisma';
import { auth } from './auth';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

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
    const existing = await prisma.tradingAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { id: 'asc' },
    });
    if (existing) return existing;

    // Create default account if none exists, guarding against concurrent creation
    const { key, keyId, keyHash } = generateBridgeKey();
    try {
        return await prisma.tradingAccount.create({
            data: {
                userId,
                name: 'Default Account',
                broker: 'Manual',
                accountNumber: `MANUAL-${userId.slice(-8).toUpperCase()}`,
                currency: 'USD',
                leverage: 100,
                bridgeKeyId: keyId,
                bridgeKeyHash: keyHash,
                bridgeKey: key, // kept during transition so existing EA configs still work
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
 * Returns the account matching a bridge key (for MT5 sync endpoint).
 * Supports both hashed keys (new) and plain-text keys (legacy).
 */
export async function getAccountByBridgeKey(bridgeKey: string) {
    const keyId = bridgeKey.slice(0, 12);

    // Try hashed lookup first (accounts that have been regenerated)
    const accountByHash = await prisma.tradingAccount.findFirst({
        where: { bridgeKeyId: keyId, isActive: true },
    });

    if (accountByHash?.bridgeKeyHash) {
        const valid = await bcrypt.compare(bridgeKey, accountByHash.bridgeKeyHash);
        return valid ? accountByHash : null;
    }

    // Fallback: legacy plain-text bridgeKey (pre-migration accounts)
    return prisma.tradingAccount.findFirst({
        where: { bridgeKey, isActive: true },
    });
}

/**
 * Generate a new bridge key, returning the plaintext key (show once),
 * the keyId (first 12 chars for lookup), and the bcrypt hash.
 */
export function generateBridgeKey() {
    const key = `prism_${randomBytes(24).toString('hex')}`;
    const keyId = key.slice(0, 12);
    const keyHash = bcrypt.hashSync(key, 10);
    return { key, keyId, keyHash };
}
