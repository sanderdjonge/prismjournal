'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, Link2, MoreVertical, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDistanceToNow, formatShortDate } from '@/lib/formatTime';

interface PreTradeNote {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    body: string;
    plannedEntry: number | null;
    status: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED';
    createdAt: string;
    trade?: {
        id: string;
        symbol: string;
        direction: string;
        pnl: number | null;
        entryTime: string;
        exitTime: string | null;
    } | null;
    account?: {
        id: string;
        name: string;
    } | null;
}

interface PreTradeNoteListProps {
    status?: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED';
    limit?: number;
    showTitle?: boolean;
    onNoteClick?: (note: PreTradeNote) => void;
}

export function PreTradeNoteList({ 
    status = 'PENDING', 
    limit = 10,
    showTitle = true,
    onNoteClick
}: PreTradeNoteListProps) {
    const [notes, setNotes] = useState<PreTradeNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            params.set('limit', String(limit));

            const response = await fetch(`/api/pre-trade-notes?${params}`);
            if (!response.ok) throw new Error('Failed to fetch notes');

            const data = await response.json();
            setNotes(data.notes);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, [status, limit]);

    const handleMarkNotRelevant = async (noteId: string) => {
        try {
            const response = await fetch('/api/pre-trade-notes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: noteId, status: 'NOT_RELEVANT' }),
            });
            if (!response.ok) throw new Error('Failed to update note');
            fetchNotes();
        } catch (err) {
            console.error('Failed to mark note as not relevant:', err);
        }
        setOpenMenuId(null);
    };

    const handleDelete = async (noteId: string) => {
        // For now, just mark as NOT_RELEVANT (soft delete)
        await handleMarkNotRelevant(noteId);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-sm text-loss">
                {error}
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="text-gray-500 text-sm">
                    {status === 'PENDING' 
                        ? 'No pending pre-trade notes'
                        : `No ${status.toLowerCase()} notes`}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {showTitle && (
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-100">
                        {status === 'PENDING' ? 'Pending Notes' : `${status.charAt(0) + status.slice(1).toLowerCase()} Notes`}
                    </h3>
                    <span className="text-xs text-gray-500">
                        {notes.length} note{notes.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            <div className="space-y-2">
                {notes.map((note) => (
                    <div
                        key={note.id}
                        onClick={() => onNoteClick?.(note)}
                        className={cn(
                            "group relative bg-white/[0.02] border border-white/10 rounded-lg p-3 transition-colors",
                            "hover:bg-white/[0.04] hover:border-white/20",
                            onNoteClick && "cursor-pointer"
                        )}
                    >
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                {/* Symbol */}
                                <span className="font-bold text-white text-sm">
                                    {note.symbol}
                                </span>
                                
                                {/* Direction Badge */}
                                <span className={cn(
                                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                    note.direction === 'LONG'
                                        ? "bg-profit/20 text-profit"
                                        : "bg-loss/20 text-loss"
                                )}>
                                    {note.direction === 'LONG' 
                                        ? <ArrowUpRight size={10} />
                                        : <ArrowDownRight size={10} />
                                    }
                                    {note.direction}
                                </span>
                            </div>

                            {/* Time + Menu */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Clock size={10} />
                                    {(() => { const diff = Date.now() - new Date(note.createdAt).getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return 'just now'; const days = Math.floor(diff / 86400000); return days >= 7 ? formatShortDate(note.createdAt) : formatDistanceToNow(note.createdAt).replace('Just now', 'just now') })()}
                                </span>
                                
                                {/* Action Menu */}
                                {status === 'PENDING' && (
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === note.id ? null : note.id);
                                            }}
                                            className="p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <MoreVertical size={14} />
                                        </button>

                                        {openMenuId === note.id && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-10" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(null);
                                                    }}
                                                />
                                                <div className="absolute right-0 top-full mt-1 z-20 py-1 bg-black/95 border border-white/10 rounded-lg shadow-xl min-w-[140px]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkNotRelevant(note.id);
                                                        }}
                                                        className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2"
                                                    >
                                                        <X size={12} />
                                                        Not Relevant
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body Preview */}
                        <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                            {note.body}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-3">
                                {note.plannedEntry && (
                                    <span className="text-gray-500">
                                        Entry: {note.plannedEntry}
                                    </span>
                                )}
                                {note.account && (
                                    <span className="text-gray-500">
                                        {note.account.name}
                                    </span>
                                )}
                            </div>

                            {/* Linked Trade Info */}
                            {note.trade && (
                                <div className="flex items-center gap-1 text-primary">
                                    <Link2 size={10} />
                                    <span>Linked</span>
                                    {note.trade.pnl !== null && (
                                        <span className={cn(
                                            "ml-1",
                                            note.trade.pnl >= 0 ? "text-profit" : "text-loss"
                                        )}>
                                            {note.trade.pnl >= 0 ? '+' : ''}
                                            {note.trade.pnl.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}