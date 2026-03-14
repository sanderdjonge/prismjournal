'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye } from 'lucide-react';
import type { JournalTrade } from '@/app/journal/page';
import {
    TradeFormFields,
    TradeEntryDetails,
    ScreenshotUpload,
} from './trade-entry';

interface TradeViewModalProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
}

export default function TradeViewModal({ trade, isOpen, onClose, onEdit }: TradeViewModalProps) {
    if (!trade) return null;

    const isClosed = !!trade.exitTime;
    const computedPnl = trade.pnl;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] glass-card bg-[#0a0a0a] border-white/5 z-[101] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">View Trade</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Read-Only Trade Details</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={onEdit}
                                    className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                                >
                                    Edit
                                </button>
                                <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                            {/* Trade Form Fields - Read Only */}
                            <TradeFormFields
                                symbol={trade.symbol}
                                onSymbolChange={() => {}}
                                side={trade.type}
                                onSideChange={() => {}}
                                volume={trade.volume.toString()}
                                onVolumeChange={() => {}}
                                entryPrice={trade.entry.toString()}
                                onEntryPriceChange={() => {}}
                                exitPrice={trade.exit?.toString() || ''}
                                onExitPriceChange={() => {}}
                                takeProfit={trade.takeProfit?.toString() || ''}
                                onTakeProfitChange={() => {}}
                                stopLoss={trade.stopLoss?.toString() || ''}
                                onStopLossChange={() => {}}
                                isClosed={isClosed}
                                onIsClosedChange={() => {}}
                                disabled={true}
                            />

                            {/* Strategy, Compliance, Mood, Notes */}
                            <TradeEntryDetails
                                strategy={trade.strategy || 'Vector Momentum (H1)'}
                                onStrategyChange={() => {}}
                                compliance={trade.planCompliance === 'FOLLOWED' ? true : trade.planCompliance === 'DEVIATED' ? false : null}
                                onComplianceChange={() => {}}
                                mood={trade.mood || 'NEUTRAL'}
                                onMoodChange={() => {}}
                                notes={trade.notes || ''}
                                onNotesChange={() => {}}
                                disabled={true}
                            />

                            {/* Screenshots placeholder */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Screenshots</label>
                                <div className="text-xs text-gray-500 italic">No screenshots attached</div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-white/[0.02]">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
