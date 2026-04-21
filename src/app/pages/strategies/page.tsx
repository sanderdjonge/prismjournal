import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import StrategiesClient from './StrategiesClient';

export default async function StrategiesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view strategies.</div>;
  }

  const strategies = await prisma.strategy.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { trades: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate metrics for each strategy
  const strategiesWithMetrics = await Promise.all(
    strategies.map(async (s) => {
      // Get violation count
      const violationCount = await prisma.strategyViolation.count({
        where: { strategyId: s.id }
      });

      // Get unique trades with violations
      const tradesWithViolations = await prisma.strategyViolation.groupBy({
        by: ['tradeId'],
        where: { strategyId: s.id },
        _count: true
      });

      // Calculate adherence
      const totalTrades = s._count.trades;
      const tradesWithViolationsCount = tradesWithViolations.length;
      const adherenceScore = totalTrades > 0 
        ? Math.round(((totalTrades - tradesWithViolationsCount) / totalTrades) * 100)
        : 100;

      const violationRate = totalTrades > 0 ? violationCount / totalTrades : 0;
      const tiltmeterScore = totalTrades === 0 ? 0 : Math.min(100, Math.round(violationRate * 100));

      return {
        id: s.id,
        name: s.name,
        description: s.description,
        createdAt: s.createdAt,
        _count: {
          trades: s._count.trades,
          violations: violationCount,
        },
        adherenceScore: Math.max(0, adherenceScore),
        tiltmeterScore,
      };
    })
  );

  return <StrategiesClient strategies={strategiesWithMetrics} />;
}
