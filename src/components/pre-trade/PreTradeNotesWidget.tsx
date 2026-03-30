'use client';

import { useState } from 'react';
import { Plus, FileText, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PreTradeNoteForm } from './PreTradeNoteForm';
import { PreTradeNoteList } from './PreTradeNoteList';

interface PreTradeNotesWidgetProps {
    className?: string;
}

export function PreTradeNotesWidget({ className }: PreTradeNotesWidgetProps) {
    const [showForm, setShowForm] = useState(false);

    return (
        <div className={cn(
            "glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold text-gray-100">Pre-Trade Notes</h3>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                        <Plus size={14} />
                        New
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="space-y-4">
                {showForm ? (
                    <div className="relative">
                        <button
                            onClick={() => setShowForm(false)}
                            className="absolute -top-2 -right-2 p-1 text-gray-500 hover:text-gray-300 bg-black/50 rounded-full z-10"
                        >
                            <X size={14} />
                        </button>
                        <PreTradeNoteForm
                            compact
                            onSuccess={() => setShowForm(false)}
                        />
                    </div>
                ) : (
                    <PreTradeNoteList
                        status="PENDING"
                        limit={5}
                        showTitle={false}
                    />
                )}
            </div>
        </div>
    );
}