'use client';

import { useState, useEffect, Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import PropFirmReferenceTable, { type PropFirmRow } from '@/components/prop-firm/PropFirmReferenceTable';
import { HelpCircle, BookOpen, Building2, Loader2 } from 'lucide-react';

function HelpContent() {
    const [firms, setFirms] = useState<PropFirmRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/prop-firms')
            .then(r => r.json())
            .then(d => setFirms(d.propFirms ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardShell>
            <div className="space-y-10 max-w-5xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <HelpCircle size={24} className="text-primary" />
                        Help & Reference
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Documentation and reference tables for PrismJournal</p>
                </div>

                {/* Getting Started */}
                <section className="glass-card p-6 border-white/5 space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <BookOpen size={16} className="text-primary" />
                        Getting Started
                    </h2>
                    <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
                        <p>PrismJournal is a trading journal built for prop firm traders. Connect your MT5 account via the bridge key in Settings, or log trades manually via the Journal.</p>
                        <p>Once trades are synced, they appear in <strong className="text-white">The Vault</strong> (Journal). Use the Analytics and Performance pages to review your statistics. Track your challenge progress on the <strong className="text-white">Accounts</strong> page.</p>
                        <p>The daily snapshot cron job runs automatically and checks your accounts against their drawdown and daily loss limits. Violations appear as notifications.</p>
                    </div>
                </section>

                {/* Prop Firm Reference */}
                <section className="glass-card p-6 border-white/5 space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Building2 size={16} className="text-primary" />
                        Prop Firm Reference
                    </h2>
                    <p className="text-xs text-gray-500">Rules and limits for supported prop firms. Used when creating a trading account.</p>
                    {loading ? (
                        <div className="flex items-center gap-2 py-4 text-gray-500">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Loading...</span>
                        </div>
                    ) : (
                        <PropFirmReferenceTable firms={firms} />
                    )}
                </section>
            </div>
        </DashboardShell>
    );
}

export default function HelpPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <HelpContent />
        </Suspense>
    );
}
