import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import StrategyRulesEditor from '@/components/strategies/StrategyRulesEditor';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';
import TiltmeterWidget from '@/components/dashboard/TiltmeterWidget';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StrategyDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: {
      trades: {
        where: { status: 'CLOSED' },
        select: { id: true, pnl: true, entryTime: true, exitTime: true },
        orderBy: { exitTime: 'desc' },
        take: 10,
      },
      _count: {
        select: { trades: true },
      },
    },
  });

  if (!strategy) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{strategy.name}</h1>
        {strategy.description && (
          <p className="text-gray-400 mt-1">{strategy.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Editor - Main Column */}
        <div className="lg:col-span-2 bg-gray-900 rounded-lg p-6">
          <StrategyRulesEditor strategyId={strategy.id} />
        </div>

        {/* Sidebar with widgets */}
        <div className="space-y-6">
          <ComplianceWidget periodDays={30} />
          <TiltmeterWidget periodDays={30} />
          
          {/* Quick Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Strategy Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Trades</span>
                <span>{strategy._count.trades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created</span>
                <span>{strategy.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      {strategy.trades.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Closed Trades</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {strategy.trades.map(trade => (
                  <tr key={trade.id} className="border-t border-gray-800">
                    <td className="py-2">
                      {trade.exitTime?.toLocaleDateString() || '—'}
                    </td>
                    <td className={`py-2 ${trade.pnl && trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
