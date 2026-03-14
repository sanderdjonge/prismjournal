'use client';

import TopNav from './TopNav';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-foreground font-sans selection:bg-primary/30 selection:text-white">
            <TopNav />
            <main className="pt-20 min-h-screen">
                <div className="px-4 py-6 w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
