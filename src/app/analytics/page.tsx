import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Spinner } from '@/components/ui/Spinner';
import { AnalyticsContent } from './AnalyticsContent';

export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
    return (
        <DashboardShell>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                    <Spinner size="lg" />
                </div>
            }>
                <AnalyticsContent />
            </Suspense>
        </DashboardShell>
    );
}
