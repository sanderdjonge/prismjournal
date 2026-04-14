import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Spinner } from '@/components/ui/Spinner';
import { PerformanceContent } from './PerformanceContent';

export const dynamic = 'force-dynamic';

export default function PerformancePage() {
    return (
        <DashboardShell>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                    <Spinner size="lg" />
                </div>
            }>
                <PerformanceContent />
            </Suspense>
        </DashboardShell>
    );
}
