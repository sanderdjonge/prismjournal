import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { PerformanceContent } from './PerformanceContent';

export default function PerformancePage() {
    return (
        <DashboardShell>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                <PerformanceContent />
            </Suspense>
        </DashboardShell>
    );
}
