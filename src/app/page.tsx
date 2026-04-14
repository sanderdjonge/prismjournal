import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import Dashboard from '@/components/dashboard/Dashboard';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Spinner } from '@/components/ui/Spinner';
import { auth } from '@/lib/auth';

function DashboardSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? 'Trader';

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header Section */}
        <header className="flex justify-between items-end mb-4 px-2">
          <div>
            <h1 className="text-4xl font-bold neon-text tracking-tight uppercase">Intelligence <span className="text-gray-500">Portal</span></h1>
            <p className="text-gray-500 mt-2 font-medium tracking-wide">Market Pulse // Welcome back, {userName}.</p>
          </div>
        </header>

        {/* Main Dashboard */}
        <ErrorBoundary>
          <Suspense fallback={<DashboardSkeleton />}>
            <Dashboard />
          </Suspense>
        </ErrorBoundary>
      </div>
    </DashboardShell>
  );
}
