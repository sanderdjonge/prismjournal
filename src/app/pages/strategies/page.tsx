import Link from 'next/link';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export default async function StrategiesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view strategies.</div>;
  }

  const strategies = await prisma.strategy.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { trades: true, violations: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Strategies</h1>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No strategies found. Strategies are created when you assign them to trades in MT5.
        </div>
      ) : (
        <div className="grid gap-4">
          {strategies.map(strategy => (
            <Link
              key={strategy.id}
              href={`/pages/strategies/${strategy.id}`}
              className="block bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{strategy.name}</h3>
                  {strategy.description && (
                    <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-400">
                  <div>{strategy._count.trades} trades</div>
                  {strategy._count.violations > 0 && (
                    <div className="text-red-400">{strategy._count.violations} violations</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
