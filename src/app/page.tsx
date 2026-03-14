import DashboardShell from '@/components/layout/DashboardShell';
import Dashboard from '@/components/dashboard/Dashboard';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? 'Trader';

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header Section */}
        <header className="flex justify-between items-end mb-4 px-2">
          <div>
            <h1 className="text-4xl font-bold neon-text tracking-tight uppercase">Intelligence <span className="text-white/20">Portal</span></h1>
            <p className="text-gray-500 mt-2 font-medium tracking-wide">Market Pulse // Welcome back, {userName}.</p>
          </div>
        </header>

        {/* Main Dashboard */}
        <Dashboard />
      </div>
    </DashboardShell>
  );
}
