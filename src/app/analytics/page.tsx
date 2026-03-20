import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { AnalyticsContent } from './AnalyticsContent';

// useSuspenseQuery suspends during SSR — force dynamic to skip static generation at build time
export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
    return (
        <DashboardShell>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                <AnalyticsContent />
            </Suspense>
        </DashboardShell>
    );
}
