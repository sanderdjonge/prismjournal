'use client';

import { useState, useEffect } from 'react';
import { TradeListPanel, ScreenshotPanel, TradeDetailPanel } from './three-panel';
import type { JournalTrade } from '@/app/journal/page';

interface JournalThreePanelViewProps {
    trades: JournalTrade[];
}

export function JournalThreePanelView({ trades }: JournalThreePanelViewProps) {
    const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);

    // Auto-select first trade when trades are loaded and nothing is selected
    useEffect(() => {
        if (trades.length > 0 && !selectedTrade) {
            setSelectedTrade(trades[0]);
        } else if (selectedTrade && !trades.find(t => t.id === selectedTrade.id)) {
            // If selected trade is no longer in the list, select the first one
            setSelectedTrade(trades.length > 0 ? trades[0] : null);
        }
    }, [trades, selectedTrade]);

    return (
        <div className="flex h-[calc(100vh-220px)] min-h-[400px]">
            {/* Left panel: Trade list */}
            <TradeListPanel
                trades={trades}
                selectedId={selectedTrade?.id ?? null}
                onSelect={setSelectedTrade}
            />

            {/* Center panel: Screenshot viewer */}
            <ScreenshotPanel trade={selectedTrade} />

            {/* Right panel: Trade details */}
            {selectedTrade ? (
                <TradeDetailPanel trade={selectedTrade} />
            ) : (
                <div className="flex flex-col items-center justify-center border-l border-white/[0.06] text-gray-600" style={{ width: 340 }}>
                    <span className="text-[9px] font-black uppercase tracking-widest">Select a trade to view details</span>
                </div>
            )}
        </div>
    );
}
