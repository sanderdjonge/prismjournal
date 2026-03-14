import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Default user
    const user = await prisma.user.upsert({
        where: { email: 'sander@prism.io' },
        update: {},
        create: {
            id: 'user_default',
            email: 'sander@prism.io',
            name: 'Sander J.',
        },
    });

    // Default trading account
    const account = await prisma.tradingAccount.upsert({
        where: { bridgeKey: 'prism_default_key' },
        update: {},
        create: {
            id: 'acc_default',
            userId: user.id,
            name: 'Main Account',
            broker: 'Default Broker',
            accountNumber: '100012345',
            currency: 'USD',
            leverage: 100,
            bridgeKey: 'prism_default_key',
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

    console.log('Seed complete. Account bridge key:', account.bridgeKey);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
