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

  // Transform to plain object for client component
  const strategiesData = strategies.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    createdAt: s.createdAt,
    _count: {
      trades: s._count.trades,
      violations: 0, // Will be calculated separately if needed
    },
  }));

  return <StrategiesClient strategies={strategiesData} />;
}
