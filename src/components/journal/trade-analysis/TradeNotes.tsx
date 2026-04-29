'use client'

import React from 'react'
import { Target } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

interface TradeNotesProps {
    value: string
    onChange: (notes: string) => void
}

export function TradeNotes({ value, onChange }: TradeNotesProps) {
    return (
        <section>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted border-b border-border-subtle pb-2 mb-3 flex items-center gap-2">
                <Target size={12} /> Trade Narrative
            </h3>
            <RichTextEditor
                value={value}
                onChange={onChange}
                placeholder="Describe the setup, execution, and what you'd do differently..."
            />
        </section>
    )
}
