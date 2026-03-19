import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// --- deterministic pseudo-random helpers (seed=42, reproducible) -------------

function rng(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

const rand = rng(42);
const randBetween = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randBetween(min, max + 1));
const randChoice = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(randInt(7, 17), randInt(0, 59), 0, 0);
    return d;
}

// --- main --------------------------------------------------------------------

async function main() {
    console.log('🌱  Seeding development database…');

    // ---- users ---------------------------------------------------------------

    const adminPassword = await bcrypt.hash('Admin1234!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@prism.dev' },
        update: {},
        create: {
            email: 'admin@prism.dev',
            name: 'Admin User',
            password: adminPassword,
            bridgeKeyId: 'prism_admin1',
            bridgeKeyHash: await bcrypt.hash('admin-bridge-key-dev', 8),
            isSuperuser: true,
            settings: {
                create: { displayCurrency: 'USD', timezone: 'Europe/Amsterdam' },
            },
        },
    });

    const traderPassword = await bcrypt.hash('Trader1234!', 12);
    const trader = await prisma.user.upsert({
        where: { email: 'trader@prism.dev' },
        update: {},
        create: {
            email: 'trader@prism.dev',
            name: 'Alex Trader',
            password: traderPassword,
            bridgeKeyId: 'prism_trade1',
            bridgeKeyHash: await bcrypt.hash('trader-bridge-key-dev', 8),
            settings: {
                create: { displayCurrency: 'USD', timezone: 'Europe/Amsterdam' },
            },
        },
    });

    console.log(`  ✓  Users: ${admin.email} (admin), ${trader.email} (trader)`);

    // ---- prop firm -----------------------------------------------------------

    const propFirm = await prisma.propFirm.upsert({
        where: { slug: 'ftmo-dev' },
        update: {},
        create: {
            name: 'FTMO (Dev)',
            slug: 'ftmo-dev',
            description: 'Development seed prop firm',
            challengeType: 'TWO_PHASE',
            dailyLossLimit: 5.0,
            maxDrawdown: 10.0,
            drawdownType: 'STATIC',
            allowNewsTrading: false,
            allowWeekendHolding: false,
            allowEA: true,
            phasesConfig: [
                { phase: 1, profitTarget: 10, maxDays: 30, minTradingDays: 10 },
                { phase: 2, profitTarget: 5, maxDays: 60, minTradingDays: 10 },
            ],
        },
    });

    // ---- accounts ------------------------------------------------------------

    const liveAccount = await prisma.tradingAccount.upsert({
        where: { id: 'acc_live' },
        update: {},
        create: {
            id: 'acc_live',
            userId: trader.id,
            name: 'MT5 Live #100012345',
            broker: 'IC Markets',
            accountNumber: '100012345',
            platform: 'METATRADER5',
            platformAccountId: '100012345',
            currency: 'USD',
            leverage: 100,
            currentBalance: 11350,
            isActive: true,
            accountType: 'OWN_MONEY',
        },
    });

    const paperAccount = await prisma.tradingAccount.upsert({
        where: { id: 'acc_paper' },
        update: {},
        create: {
            id: 'acc_paper',
            userId: trader.id,
            name: 'Paper Trading',
            broker: 'Demo Broker',
            accountNumber: '999888777',
            platform: 'MANUAL',
            platformAccountId: '999888777',
            currency: 'USD',
            leverage: 50,
            currentBalance: 52100,
            isActive: true,
            accountType: 'OWN_MONEY',
        },
    });

    const propAccount = await prisma.tradingAccount.upsert({
        where: { id: 'acc_prop' },
        update: {},
        create: {
            id: 'acc_prop',
            userId: trader.id,
            name: 'FTMO Phase 1 — $10K',
            broker: 'FTMO',
            accountNumber: 'FTMO-12345',
            platform: 'METATRADER5',
            platformAccountId: 'FTMO-12345',
            currency: 'USD',
            leverage: 100,
            currentBalance: 10620,
            isActive: true,
            accountType: 'PROPFIRM',
            propFirmId: propFirm.id,
        },
    });

    console.log(`  ✓  Accounts: live (MT5), paper (manual), prop (FTMO)`);

    // ---- strategies ----------------------------------------------------------

    const strategyDefs = [
        'Vector Momentum (H1)',
        'Range Liquidity Sweep',
        'News Event Volatility',
        'Mean Reversion (M15)',
        'Breakout Continuation',
        'Other / Experimental',
    ];

    const strategies = await Promise.all(
        strategyDefs.map((name) =>
            prisma.strategy.upsert({
                where: { id: `strat_${name.replace(/\W+/g, '_').toLowerCase()}` },
                update: {},
                create: {
                    id: `strat_${name.replace(/\W+/g, '_').toLowerCase()}`,
                    userId: trader.id,
                    name,
                },
            })
        )
    );

    // ---- tags ----------------------------------------------------------------

    const tagDefs = [
        { name: 'High Conviction', color: '#4ade80' },
        { name: 'Revenge Trade',   color: '#f87171' },
        { name: 'FOMO',            color: '#fb923c' },
        { name: 'Clean Setup',     color: '#818cf8' },
        { name: 'Pre-News',        color: '#fbbf24' },
    ];

    const tags = await Promise.all(
        tagDefs.map(({ name, color }) =>
            prisma.tag.upsert({
                where: { id: `tag_${name.replace(/\W+/g, '_').toLowerCase()}` },
                update: {},
                create: {
                    id: `tag_${name.replace(/\W+/g, '_').toLowerCase()}`,
                    userId: trader.id,
                    name,
                    color,
                },
            })
        )
    );

    console.log(`  ✓  Strategies: ${strategies.length}, Tags: ${tags.length}`);

    // ---- trades --------------------------------------------------------------

    const symbols = ['EURUSD', 'GBPUSD', 'XAUUSD', 'US30', 'NAS100', 'GBPJPY', 'USDJPY', 'AUDUSD'];
    const basePrices: Record<string, number> = {
        EURUSD: 1.085, GBPUSD: 1.265, XAUUSD: 2300, US30: 38000,
        NAS100: 17500, GBPJPY: 191.0, USDJPY: 149.5, AUDUSD: 0.655,
    };
    const moods: ('CALM' | 'CONFIDENT' | 'ANXIOUS' | 'FOMO' | 'REVENGE' | 'NEUTRAL')[] =
        ['CALM', 'CONFIDENT', 'ANXIOUS', 'FOMO', 'REVENGE', 'NEUTRAL'];
    const compliances: ('FOLLOWED' | 'DEVIATED' | 'PARTIAL')[] = ['FOLLOWED', 'DEVIATED', 'PARTIAL'];
    const sampleNotes = [
        'Clean breakout above key resistance — followed plan.',
        'Liquidity sweep confirmed before entry.',
        'Should have exited at first TP level.',
        'News spike — unexpected volatility, stopped out.',
        'Textbook higher-low structure on H1.',
        'FOMO entry — chased the move, poor RR.',
        'Pre-market range, held until London open.',
        'Correlation trade with DXY divergence.',
    ];

    const accountPool = [
        { acc: liveAccount, weight: 0.5 },
        { acc: paperAccount, weight: 0.3 },
        { acc: propAccount, weight: 0.2 },
    ];

    const existingCount = await prisma.trade.count({
        where: { accountId: { in: accountPool.map((a) => a.acc.id) } },
    });

    if (existingCount >= 150) {
        console.log(`  ✓  Trades: ${existingCount} already exist, skipping`);
    } else {
        let created = 0;
        let attempted = 0;

        while (created < 200 && attempted < 400) {
            attempted++;
            const daysBack = randInt(1, 365);
            const entryTime = daysAgo(daysBack);

            // Skip weekends
            const dow = entryTime.getDay();
            if (dow === 0 || dow === 6) continue;

            const symbol = randChoice(symbols);
            const direction = rand() > 0.48 ? 'LONG' : 'SHORT';
            const base = basePrices[symbol];
            const pip = base > 100 ? 1.0 : 0.0001;

            const entryPrice = parseFloat((base + (rand() - 0.5) * pip * 50).toFixed(5));
            const isWin = rand() < 0.58; // 58% win rate
            const riskAmount = randBetween(60, 350);
            const rrMultiple = isWin ? randBetween(1.0, 3.5) : randBetween(0.3, 1.0);
            const rawPnl = isWin ? riskAmount * rrMultiple : -(riskAmount * rrMultiple);
            const pnl = parseFloat(rawPnl.toFixed(2));

            const pipMove = Math.abs(pnl) / 10; // simplified
            const exitPrice = parseFloat((
                direction === 'LONG'
                    ? entryPrice + (pnl >= 0 ? pipMove : -pipMove) * pip
                    : entryPrice - (pnl >= 0 ? pipMove : -pipMove) * pip
            ).toFixed(5));

            const durationMinutes = randInt(20, 480);
            const exitTime = new Date(entryTime.getTime() + durationMinutes * 60_000);

            // Weighted account selection
            const r = rand();
            let cumWeight = 0;
            let selectedAcc = accountPool[0].acc;
            for (const { acc, weight } of accountPool) {
                cumWeight += weight;
                if (r < cumWeight) { selectedAcc = acc; break; }
            }

            try {
                await prisma.trade.create({
                    data: {
                        accountId: selectedAcc.id,
                        strategyId: rand() > 0.15 ? randChoice(strategies).id : undefined,
                        symbol,
                        direction: direction as 'LONG' | 'SHORT',
                        status: 'CLOSED',
                        entryPrice,
                        exitPrice,
                        stopLoss: parseFloat((
                            direction === 'LONG' ? entryPrice - pip * 15 : entryPrice + pip * 15
                        ).toFixed(5)),
                        takeProfit: parseFloat((
                            direction === 'LONG' ? entryPrice + pip * 30 : entryPrice - pip * 30
                        ).toFixed(5)),
                        volume: parseFloat(randBetween(0.01, 0.5).toFixed(2)),
                        entryTime,
                        exitTime,
                        pnl,
                        commission: parseFloat((-randBetween(1, 8)).toFixed(2)),
                        rMultiple: parseFloat((rawPnl / riskAmount).toFixed(2)),
                        mood: rand() > 0.25 ? randChoice(moods) : undefined,
                        planCompliance: rand() > 0.3 ? randChoice(compliances) : undefined,
                        entryRating: rand() > 0.4 ? randInt(1, 5) : undefined,
                        exitRating: rand() > 0.4 ? randInt(1, 5) : undefined,
                        managementRating: rand() > 0.5 ? randInt(1, 5) : undefined,
                        source: selectedAcc.platform === 'MANUAL' ? 'MANUAL' : 'LIVE',
                        platform: selectedAcc.platform as 'METATRADER5' | 'MANUAL',
                        notes: rand() > 0.55 ? randChoice(sampleNotes) : undefined,
                    },
                });
                created++;
            } catch {
                // Unique constraint hit — skip
            }
        }
        console.log(`  ✓  Trades: ${created} created`);
    }

    console.log('');
    console.log('✅  Seed complete.');
    console.log('');
    console.log('  Admin:  admin@prism.dev  / Admin1234!');
    console.log('  Trader: trader@prism.dev / Trader1234!');
    console.log('');
    console.log('  Run: npx tsx prisma/seed.ts');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
