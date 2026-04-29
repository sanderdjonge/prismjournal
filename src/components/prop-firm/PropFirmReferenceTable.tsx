'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PropFirmRow {
    id: string;
    name: string;
    challengeType: string;
    dailyLossLimit: number;
    maxDrawdown: number;
    drawdownType: string;
    allowNewsTrading: boolean;
    allowWeekendHolding: boolean;
    allowEA: boolean;
    hasScalingPlan: boolean;
    phasesConfig: string;
}

interface PropFirmReferenceTableProps {
    firms: PropFirmRow[];
}

function parsePhaseCount(config: string): number {
    try { return JSON.parse(config).length; } catch { return 0; }
}

const CHALLENGE_LABELS: Record<string, string> = {
    ONE_PHASE: '1-Phase',
    TWO_PHASE: '2-Phase',
    THREE_PHASE: '3-Phase',
};

const CHALLENGE_COLORS: Record<string, string> = {
    ONE_PHASE: 'text-profit',
    TWO_PHASE: 'text-blue-400',
    THREE_PHASE: 'text-purple-400',
};

export default function PropFirmReferenceTable({ firms }: PropFirmReferenceTableProps) {
    if (firms.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-border-subtle">
                        {['Prop Firm', 'Type', 'Phases', 'Daily Loss', 'Max DD', 'DD Type', 'News', 'Weekend', 'EA', 'Scaling'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-text-muted">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {firms.map((firm) => (
                        <tr key={firm.id} className="border-b border-border-subtle hover:bg-surface-hover transition-colors">
                            <td className="px-3 py-3 font-bold text-white">{firm.name}</td>
                            <td className="px-3 py-3">
                                <span className={cn('font-bold', CHALLENGE_COLORS[firm.challengeType] ?? 'text-text-muted')}>
                                    {CHALLENGE_LABELS[firm.challengeType] ?? firm.challengeType.replace(/_/g, ' ')}
                                </span>
                            </td>
                            <td className="px-3 py-3 text-text-secondary">{parsePhaseCount(firm.phasesConfig) || '—'}</td>
                            <td className="px-3 py-3 text-orange-400 font-bold">{firm.dailyLossLimit}%</td>
                            <td className="px-3 py-3 text-orange-400 font-bold">{firm.maxDrawdown}%</td>
                            <td className="px-3 py-3 text-text-secondary">{firm.drawdownType}</td>
                            {[firm.allowNewsTrading, firm.allowWeekendHolding, firm.allowEA].map((allowed, i) => (
                                <td key={i} className="px-3 py-3">
                                    {allowed
                                        ? <CheckCircle size={14} className="text-profit" />
                                        : <XCircle size={14} className="text-loss" />}
                                </td>
                            ))}
                            <td className="px-3 py-3">
                                {firm.hasScalingPlan
                                    ? <CheckCircle size={14} className="text-profit" />
                                    : <XCircle size={14} className="text-loss" />}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
