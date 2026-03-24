'use client';

const CLOSE_REASON_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    SL:       { label: 'SL',       bg: 'bg-red-500/15',    text: 'text-red-400'    },
    TP:       { label: 'TP',       bg: 'bg-emerald-500/15',text: 'text-emerald-400'},
    MANUAL:   { label: 'Manual',   bg: 'bg-white/5',       text: 'text-gray-400'   },
    EA:       { label: 'EA',       bg: 'bg-cyan-500/15',   text: 'text-cyan-400'   },
    STOP_OUT: { label: 'Stop Out', bg: 'bg-orange-500/15', text: 'text-orange-400' },
};

export function CloseReasonBadge({ reason }: { reason?: string | null }) {
    if (!reason) return <span className="text-gray-600 text-[10px]">—</span>;
    const cfg = CLOSE_REASON_CONFIG[reason] ?? CLOSE_REASON_CONFIG.MANUAL;
    return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
        </span>
    );
}
