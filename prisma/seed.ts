import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Default user with bridge key (moved from TradingAccount)
    const user = await prisma.user.upsert({
        where: { email: 'sander@prism.io' },
        update: {},
        create: {
            id: 'user_default',
            email: 'sander@prism.io',
            name: 'Sander J.',
            bridgeKeyId: 'prism_defau',  // First 12 chars of bridge key
            bridgeKeyHash: '$2a$10$dummyHashForDevelopmentPurposesOnly',  // Placeholder hash
        },
    });

    // Default trading account (bridge key now on User)
    const account = await prisma.tradingAccount.upsert({
        where: { id: 'acc_default' },
        update: {},
        create: {
            id: 'acc_default',
            userId: user.id,
            name: 'MT5 #100012345',
            broker: 'Default Broker',
            accountNumber: '100012345',
            platform: 'METATRADER5',
            platformAccountId: '100012345',
            currency: 'USD',
            leverage: 100,
            isActive: true,
        },
    });

    // Default strategies
    const strategyNames = [
        'Vector Momentum (H1)',
        'Range Liquidity Sweep',
        'News Event Volatility',
        'Mean Reversion (M15)',
        'Other / Experimental',
    ];

    for (const name of strategyNames) {
        await prisma.strategy.upsert({
            where: { id: `strat_${name.replace(/\W+/g, '_').toLowerCase()}` },
            update: {},
            create: {
                id: `strat_${name.replace(/\W+/g, '_').toLowerCase()}`,
                userId: user.id,
                name,
            },
        });
    }

    console.log('Seed complete.');
    console.log('User bridge key ID:', user.bridgeKeyId);
    console.log('Account:', account.name, `(${account.platform})`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
