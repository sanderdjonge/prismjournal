import { PrismaClient, ChallengeType, DrawdownType } from '@prisma/client';

const prisma = new PrismaClient();

interface PhaseConfig {
  phaseNumber: number;
  phaseName: string;
  profitTarget: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  minTradingDays?: number;
  timeLimitDays?: number;
}

interface PropFirmData {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  challengeType: ChallengeType;
  dailyLossLimit: number;
  maxDrawdown: number;
  drawdownType: DrawdownType;
  allowNewsTrading: boolean;
  allowWeekendHolding: boolean;
  allowEA: boolean;
  phases: PhaseConfig[];
  hasScalingPlan: boolean;
  scalingConfig?: string;
  popularity: number;
}

const propFirms: PropFirmData[] = [
  {
    name: 'FTMO',
    slug: 'ftmo',
    description: 'One of the most popular and trusted prop firms. Offers 2-phase challenges with competitive profit splits up to 90%.',
    website: 'https://ftmo.com',
    challengeType: ChallengeType.TWO_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 10.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Challenge',
        profitTarget: 10.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
        minTradingDays: 4,
      },
      {
        phaseNumber: 2,
        phaseName: 'Verification',
        profitTarget: 5.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
        minTradingDays: 4,
      },
    ],
    hasScalingPlan: true,
    scalingConfig: JSON.stringify({
      initialBalance: 400000,
      increment: 25000,
      conditions: {
        profitMonths: 4,
        minProfit: 10,
        maxDrawdown: 5,
      },
    }),
    popularity: 100,
  },
  {
    name: 'The Funded Trader',
    slug: 'the-funded-trader',
    description: 'Popular prop firm with competitive pricing and multiple challenge types. Profit split up to 90%.',
    website: 'https://thefundedtraderprogram.com',
    challengeType: ChallengeType.TWO_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 10.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: false,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Challenge',
        profitTarget: 10.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
      {
        phaseNumber: 2,
        phaseName: 'Verification',
        profitTarget: 5.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
    ],
    hasScalingPlan: true,
    popularity: 95,
  },
  {
    name: 'MyForexFunds',
    slug: 'myforexfunds',
    description: 'Offers multiple challenge types including 3-phase challenges. Known for fast funding process.',
    website: 'https://myforexfunds.com',
    challengeType: ChallengeType.THREE_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 10.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: false,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Phase 1',
        profitTarget: 8.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
      {
        phaseNumber: 2,
        phaseName: 'Phase 2',
        profitTarget: 5.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
      {
        phaseNumber: 3,
        phaseName: 'Phase 3',
        profitTarget: 5.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
    ],
    hasScalingPlan: false,
    popularity: 90,
  },
  {
    name: 'Funding Pips',
    slug: 'funding-pips',
    description: 'Single-phase challenge with quick evaluation. Great for experienced traders who want fast funding.',
    website: 'https://fundingpips.com',
    challengeType: ChallengeType.ONE_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 8.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Evaluation',
        profitTarget: 8.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 8.0,
        timeLimitDays: 30,
      },
    ],
    hasScalingPlan: false,
    popularity: 85,
  },
  {
    name: 'The5ers',
    slug: 'the5ers',
    description: 'Unique 1-phase model with instant funding options. Good for consistent traders.',
    website: 'https://the5ers.com',
    challengeType: ChallengeType.ONE_PHASE,
    dailyLossLimit: 3.0,
    maxDrawdown: 6.0,
    drawdownType: DrawdownType.TRAILING,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Evaluation',
        profitTarget: 6.0,
        dailyLossLimit: 3.0,
        maxDrawdown: 6.0,
        timeLimitDays: 180,
      },
    ],
    hasScalingPlan: true,
    scalingConfig: JSON.stringify({
      type: 'automatic',
      levels: [
        { profit: 10, balanceIncrease: 25 },
        { profit: 20, balanceIncrease: 50 },
      ],
    }),
    popularity: 80,
  },
  {
    name: 'FundedNext',
    slug: 'fundednext',
    description: '2-phase challenge with competitive pricing. Offers both standard and aggressive challenge options.',
    website: 'https://fundednext.com',
    challengeType: ChallengeType.TWO_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 10.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Challenge',
        profitTarget: 10.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
      {
        phaseNumber: 2,
        phaseName: 'Verification',
        profitTarget: 5.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 10.0,
      },
    ],
    hasScalingPlan: true,
    popularity: 75,
  },
  {
    name: 'E8 Funding',
    slug: 'e8-funding',
    description: 'Single-phase evaluation with straightforward rules. Good profit split options.',
    website: 'https://e8funding.com',
    challengeType: ChallengeType.ONE_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 8.0,
    drawdownType: DrawdownType.STATIC,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Evaluation',
        profitTarget: 8.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 8.0,
      },
    ],
    hasScalingPlan: false,
    popularity: 70,
  },
  {
    name: 'Apex Trader Funding',
    slug: 'apex-trader-funding',
    description: 'Popular for futures trading. Single-phase evaluation with trailing drawdown.',
    website: 'https://apextraderfunding.com',
    challengeType: ChallengeType.ONE_PHASE,
    dailyLossLimit: 3.0,
    maxDrawdown: 6.0,
    drawdownType: DrawdownType.TRAILING,
    allowNewsTrading: true,
    allowWeekendHolding: false,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Evaluation',
        profitTarget: 10.0,
        dailyLossLimit: 3.0,
        maxDrawdown: 6.0,
      },
    ],
    hasScalingPlan: false,
    popularity: 65,
  },
  {
    name: 'Topstep',
    slug: 'topstep',
    description: 'Well-established futures prop firm with 2-phase evaluation. Strong community support.',
    website: 'https://topstep.com',
    challengeType: ChallengeType.TWO_PHASE,
    dailyLossLimit: 3.0,
    maxDrawdown: 10.0,
    drawdownType: DrawdownType.TRAILING,
    allowNewsTrading: true,
    allowWeekendHolding: false,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Trading Combine',
        profitTarget: 10.0,
        dailyLossLimit: 3.0,
        maxDrawdown: 10.0,
      },
      {
        phaseNumber: 2,
        phaseName: 'Fund Prep',
        profitTarget: 5.0,
        dailyLossLimit: 3.0,
        maxDrawdown: 10.0,
      },
    ],
    hasScalingPlan: false,
    popularity: 60,
  },
  {
    name: 'Uprofit',
    slug: 'uprofit',
    description: 'Single-phase futures funding with competitive pricing. Quick evaluation process.',
    website: 'https://uprofit.com',
    challengeType: ChallengeType.ONE_PHASE,
    dailyLossLimit: 5.0,
    maxDrawdown: 6.0,
    drawdownType: DrawdownType.TRAILING,
    allowNewsTrading: true,
    allowWeekendHolding: false,
    allowEA: true,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Evaluation',
        profitTarget: 10.0,
        dailyLossLimit: 5.0,
        maxDrawdown: 6.0,
      },
    ],
    hasScalingPlan: false,
    popularity: 55,
  },
];

async function main() {
  console.log('Starting prop firm seed...');

  for (const firm of propFirms) {
    const existing = await prisma.propFirm.findUnique({
      where: { slug: firm.slug },
    });

    if (existing) {
      console.log(`Updating existing prop firm: ${firm.name}`);
      await prisma.propFirm.update({
        where: { slug: firm.slug },
        data: {
          name: firm.name,
          description: firm.description,
          website: firm.website,
          challengeType: firm.challengeType,
          dailyLossLimit: firm.dailyLossLimit,
          maxDrawdown: firm.maxDrawdown,
          drawdownType: firm.drawdownType,
          allowNewsTrading: firm.allowNewsTrading,
          allowWeekendHolding: firm.allowWeekendHolding,
          allowEA: firm.allowEA,
          phasesConfig: JSON.stringify(firm.phases),
          hasScalingPlan: firm.hasScalingPlan,
          scalingConfig: firm.scalingConfig,
          popularity: firm.popularity,
        },
      });
    } else {
      console.log(`Creating new prop firm: ${firm.name}`);
      await prisma.propFirm.create({
        data: {
          name: firm.name,
          slug: firm.slug,
          description: firm.description,
          website: firm.website,
          challengeType: firm.challengeType,
          dailyLossLimit: firm.dailyLossLimit,
          maxDrawdown: firm.maxDrawdown,
          drawdownType: firm.drawdownType,
          allowNewsTrading: firm.allowNewsTrading,
          allowWeekendHolding: firm.allowWeekendHolding,
          allowEA: firm.allowEA,
          phasesConfig: JSON.stringify(firm.phases),
          hasScalingPlan: firm.hasScalingPlan,
          scalingConfig: firm.scalingConfig,
          popularity: firm.popularity,
        },
      });
    }
  }

  console.log('Prop firm seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
