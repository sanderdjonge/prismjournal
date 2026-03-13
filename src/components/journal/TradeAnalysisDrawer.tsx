'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/currency';
import type { JournalTrade } from '@/app/journal/page';
import {
    Lightbox,
    ScreenshotUploader,
    MoodSelector,
    ComplianceSelector,
    TradeNotes,
    type Screenshot,
} from './trade-analysis';

interface TradeAnalysisDrawerProps {
    trade: JournalTrade | null;
    isOpen: boolean;
    onClose: () => void;
    onSaved: (updated: JournalTrade) => void;
    onDeleted: (id: string) => void;
}

export default function TradeAnalysisDrawer({ trade, isOpen, onClose, onSaved, onDeleted }: TradeAnalysisDrawerProps) {
    const [mood, setMood] = useState('');
    const [compliance, setCompliance] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [uploading, setUploading] = useState<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const { formatPnl } = useCurrency();

    useEffect(() => {
        if (trade) {
            setMood(trade.mood ?? 'NEUTRAL');
            setCompliance(trade.planCompliance ?? '');
            setNotes(trade.notes ?? '');
            setScreenshots([]);
            // Load existing screenshots
            fetch(`/api/trades/${trade.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data.media?.length) {
                        setScreenshots(data.media.map((m: { url: string; timeframe: string }) => ({
                            url: m.url,
                            timeframe: m.timeframe,
                        })));
                    }
                })
                .catch(() => {});
        }
    }, [trade]);

    if (!trade) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`/api/trades/${trade.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mood, planCompliance: compliance || undefined, notes: notes.trim() || undefined }),
            });
            onSaved({ ...trade, mood, planCompliance: compliance, notes });
        } catch { /* silent */ } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this trade record? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' });
            onDeleted(trade.id);
        } catch { /* silent */ } finally { setDeleting(false); }
    };

    const handleUpload = async (file: File, timeframe: string) => {
        setUploading(timeframe);
        const form = new FormData();
        form.append('file', file);
        form.append('timeframe', timeframe);
        try {
            const res = await fetch(`/api/trades/${trade.id}/upload`, { method: 'POST', body: form });
            if (!res.ok) throw new Error();
            const { url } = await res.json();
            setScreenshots(prev => [...prev.filter(s => s.timeframe !== timeframe), { url, timeframe }]);
        } catch { /* silent */ } finally { setUploading(null); }
    };

    return (
        <>
        {lightboxUrl && <Lightbox src={lightboxUrl} alt="Trade screenshot" onClose={() => setLightboxUrl(null)} />}
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />

                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#0a0a0a] border-l border-white/5 z-[101] shadow-2xl flex flex-col overflow-y-auto no-scrollbar"
                    >
                        <div className="p-6 flex-1 flex flex-col gap-6">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">{trade.symbol}</h2>
                                        <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                            trade.type === 'BUY' ? "text-accent border-accent/20 bg-accent/5" : "text-danger border-danger/20 bg-danger/5")}>
                                            {trade.type === 'BUY' ? 'Long' : 'Short'}
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
                                        {trade.ticket} {'//'} {trade.time}
                                    </p>
                                </div>
                                <button onClick={onClose} className="w-10 h-10 rounded-full glass-card border-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* PnL + Volume */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="glass-card p-4 border-white/5 bg-white/5 space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Net Result</p>
                                    <p className={cn("text-2xl font-black tracking-tighter", trade.pnl >= 0 ? "text-accent" : "text-danger")}>
                                        {formatPnl(trade.pnl)}
                                    </p>
                                </div>
                                <div className="glass-card p-4 border-white/5 bg-white/5 space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Volume (Lots)</p>
                                    <p className="text-2xl font-black tracking-tighter text-white">{trade.volume.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Execution Quality */}
                            <ComplianceSelector 
                                value={compliance} 
                                onChange={setCompliance} 
                                strategy={trade.strategy} 
                            />

                            {/* Narrative */}
                            <TradeNotes value={notes} onChange={setNotes} />

                            {/* Psychology */}
                            <MoodSelector value={mood} onChange={setMood} />

                            {/* Screenshots */}
                            <ScreenshotUploader 
                                screenshots={screenshots}
                                uploading={uploading}
                                onUpload={handleUpload}
                                onLightbox={setLightboxUrl}
                            />
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/5 flex gap-3 shrink-0">
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-3 rounded-xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.4)] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50">
                                <Save size={14} /> {saving ? 'Saving...' : 'Save Analysis'}
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="flex-1 py-3 rounded-xl glass-card bg-danger/10 border-danger/20 text-danger font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 hover:bg-danger/20 transition-all active:scale-95 disabled:opacity-50">
                                {deleting ? 'Deleting...' : 'Delete Record'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
        </>
    );
}
