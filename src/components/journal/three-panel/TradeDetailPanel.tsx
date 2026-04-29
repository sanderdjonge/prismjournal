'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Share2, Plus, X, ChevronDown } from 'lucide-react'
import { useUpdateTrade } from '@/hooks/useTrades'
import { useTags, useCreateTag } from '@/hooks/useTags'
import { useStrategies } from '@/hooks/useStrategies'
import { useCurrency } from '@/lib/currency'
import { fmtDecimals } from '@/lib/formatNumber'
import { apiFetch } from '@/lib/api/client'
import { ExcursionBar } from '@/components/journal/ExcursionBar'
import { TradePnlCurve } from '@/components/journal/TradePnlCurve'
import { RelatedTrades } from '@/components/journal/RelatedTrades'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { computeDuration, deriveListZone } from './TradeListPanel'
import { MOOD_OPTIONS, COMPLIANCE_OPTIONS } from '@/constants/tradeConfig'
import { SetupChecklist, SetupChecklistRef } from '@/components/pre-trade/SetupChecklist'
import { ShareTradeModal } from '@/components/trades/ShareTradeModal'
import type { JournalTrade } from '@/app/journal/page'

interface ChecklistItemWithRequired {
    id: string;
    label: string;
    required: boolean;
    order: number;
}

interface StrategyWithChecklist {
    id: string;
    name: string;
    checklist: {
        id: string;
        name: string;
        items: ChecklistItemWithRequired[];
    } | null;
}

interface TradeDetailPanelProps {
    trade: JournalTrade;
    onNavigateTrade?: (tradeId: string) => void;
}

function Stars({
    value,
    onChange,
}: {
    value: number | null | undefined;
    onChange: (n: number) => void;
}) {
    const [hovered, setHovered] = useState<number | null>(null);
    const active = hovered ?? value ?? 0;
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(null)}
                    className="p-1 text-[16px] leading-none transition-colors cursor-pointer hover:scale-110"
                    style={{ color: n <= active ? '#facc15' : '#374151' }}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-surface-elevated border border-border-subtle rounded-lg px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted mb-1">{label}</div>
            {children}
        </div>
    );
}

export function TradeDetailPanel({ trade, onNavigateTrade }: TradeDetailPanelProps) {
    const { formatPnl } = useCurrency()
    const update = useUpdateTrade();
    const { data: tagsData } = useTags();
    const createTag = useCreateTag();
    const allTags = tagsData?.tags ?? [];
    const { data: strategiesData } = useStrategies();
    const allStrategies = strategiesData?.strategies ?? [];
    const checklistRef = useRef<SetupChecklistRef>(null);

    const [notes, setNotes] = useState(trade.notes ?? '');
    const [mood, setMood] = useState(trade.mood ?? '');
    const [compliance, setCompliance] = useState(trade.planCompliance ?? '');
    const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(trade.strategyId ?? null);
    const [strategy, setStrategy] = useState<StrategyWithChecklist | null>(null);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [showTagInput, setShowTagInput] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
    const [entryRating, setEntryRating] = useState<number | null>(trade.entryRating ?? null);
    const [exitRating, setExitRating] = useState<number | null>(trade.exitRating ?? null);
    const [managementRating, setManagementRating] = useState<number | null>(trade.managementRating ?? null);
    const [relatedTradeIds, setRelatedTradeIds] = useState<string[]>([]);

    useEffect(() => {
        setNotes(trade.notes ?? '');
        setMood(trade.mood ?? '');
        setCompliance(trade.planCompliance ?? '');
        setSelectedStrategyId(trade.strategyId ?? null);
        setStrategy(null);
        setCheckedItems({});
        setSelectedTagIds(trade.tags?.map(t => t.id) ?? []);
        setShowTagInput(false);
        setNewTagName('');
        setEntryRating(trade.entryRating ?? null);
        setExitRating(trade.exitRating ?? null);
        setManagementRating(trade.managementRating ?? null);
        setRelatedTradeIds((trade as JournalTrade & { relatedTradeIds?: string[] }).relatedTradeIds ?? []);
    }, [trade.id]);

    useEffect(() => {
        if (selectedStrategyId) {
            apiFetch<StrategyWithChecklist>(`/api/strategies/${selectedStrategyId}`)
                .then(data => {
                    setStrategy(data)
                    apiFetch(`/api/checklist-completions?tradeId=${trade.id}`)
                        .then((compData: Record<string, unknown>) => {
                            if (compData.hasStrategy && compData.checkedState) {
                                setCheckedItems(compData.checkedState as Record<string, boolean>)
                            } else {
                                setCheckedItems({})
                            }
                        })
                        .catch(() => setCheckedItems({}))
                })
                .catch(() => {
                    setStrategy(null)
                })
        } else {
            setStrategy(null)
            setCheckedItems({})
        }
    }, [selectedStrategyId, trade.id])

    const handleRating = (field: 'entryRating' | 'exitRating' | 'managementRating', val: number) => {
        if (field === 'entryRating') setEntryRating(val);
        else if (field === 'exitRating') setExitRating(val);
        else if (field === 'managementRating') setManagementRating(val);
        
        update.mutate(
            { id: trade.id, body: { [field]: val } },
            { 
                onSuccess: () => toast.success('Rating saved'),
                onError: () => toast.error('Failed to save rating'),
            },
        );
    };

    const handleSave = async () => {
        const updates: Record<string, unknown> = {
            notes: notes || null,
            mood: mood || null,
            planCompliance: compliance || null,
        };
        
        if (selectedStrategyId !== trade.strategyId) {
            updates.strategyId = selectedStrategyId;
        }
        
        if (checklistRef.current) {
            await checklistRef.current.save();
        }
        
        update.mutate(
            { id: trade.id, body: updates },
            {
                onSuccess: () => toast.success('Saved'),
                onError: () => toast.error('Save failed'),
            },
        );
    };

    const handleStrategyChange = (strategyId: string | null) => {
        setSelectedStrategyId(strategyId);
        setShowStrategyDropdown(false);
        update.mutate(
            { id: trade.id, body: { strategyId } },
            {
                onSuccess: () => toast.success('Strategy updated'),
                onError: () => toast.error('Failed to update strategy'),
            },
        );
    };

    const handleSaveTags = async (tagIds: string[]) => {
        try {
            await fetch(`/api/trades/${trade.id}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds }),
            })
            toast.success('Tags updated')
        } catch (err) {
            toast.error('Failed to update tags')
        }
    }

    const handleToggleTag = (tagId: string) => {
        const newTagIds = selectedTagIds.includes(tagId)
            ? selectedTagIds.filter(id => id !== tagId)
            : [...selectedTagIds, tagId];
        setSelectedTagIds(newTagIds);
        handleSaveTags(newTagIds);
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        try {
            const tag = await createTag.mutateAsync({ name: newTagName.trim() });
            const newTagIds = [...selectedTagIds, tag.id];
            setSelectedTagIds(newTagIds);
            await handleSaveTags(newTagIds);
            setNewTagName('');
            setShowTagInput(false);
        } catch (err) {
            toast.error('Failed to create tag');
        }
    };

    const handleLinkedChange = useCallback(async () => {
        try {
            const data = await apiFetch<{ relatedTradeIds: string[] }>(`/api/trades/${trade.id}`)
            setRelatedTradeIds(data.relatedTradeIds ?? [])
        } catch {
            toast.error('Failed to refresh linked trades')
        }
    }, [trade.id])

    const isForex = /USD|EUR|GBP|JPY|CHF|AUD|CAD|NZD/i.test(trade.symbol);
    const fmt = (v: number) => isForex ? v.toFixed(5) : v.toFixed(0);

    const duration = computeDuration(trade.entryTime, trade.exitTime);
    const zone = deriveListZone(trade);

    const exitDist = trade.exit && trade.exit > 0 && trade.mae && trade.mfe
        ? (trade.type === 'LONG' ? trade.exit - trade.entry : trade.entry - trade.exit)
        : null;

    const entryDateStr = trade.entryTime
        ? new Date(trade.entryTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            + ' · '
            + new Date(trade.entryTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';

    const exitDateStr = trade.exitTime
        ? new Date(trade.exitTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            + ' · '
            + new Date(trade.exitTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';

    return (
        <div
            className="flex flex-col min-h-0 border-l border-border-subtle overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
            style={{ width: 340 }}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">Trade Details</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShareModalOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
                        title="Share trade"
                    >
                        <Share2 size={14} />
                    </button>
                    {zone && (
                        <span className={`text-[8px] font-black uppercase tracking-[0.12em] px-2 py-[2px] rounded ${
                            zone === 'Clean' ? 'bg-profit/10 text-profit' :
                            zone === 'Painful' ? 'bg-loss/10 text-loss' :
                            zone === 'EarlyOut' ? 'bg-yellow-400/10 text-yellow-400' :
                            'bg-orange-400/10 text-orange-400'
                        }`}>{zone}</span>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4 min-h-0">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="font-mono text-[26px] font-black italic text-white tracking-tight leading-none">{trade.symbol}</div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[9px] font-black uppercase tracking-[0.08em] px-[5px] py-[1px] rounded-[3px] ${
                                trade.type === 'LONG' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                            }`}>{trade.type}</span>
                            <span className="text-[9px] font-semibold text-text-muted">{fmtDecimals(trade.volume, 2)} lots</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`font-mono text-[20px] font-bold leading-none ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatPnl(trade.pnl)}
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted mt-1">
                            {trade.pnl >= 0 ? 'profit' : 'loss'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-[6px]">
                    <Cell label="Entry">
                        <span className="font-mono text-[13px] font-semibold text-primary">{fmt(trade.entry)}</span>
                    </Cell>
                    <Cell label="Exit">
                        <span className="font-mono text-[13px] font-semibold text-white">{trade.exit && trade.exit > 0 ? fmt(trade.exit) : '—'}</span>
                    </Cell>
                    <Cell label="Stop Loss">
                        <div className="flex flex-col">
                            <span className="font-mono text-[13px] font-semibold text-loss">{trade.stopLoss ? fmt(trade.stopLoss) : '—'}</span>
                            {(trade as { initialStopLoss?: number | null }).initialStopLoss != null &&
                             (trade as { initialStopLoss?: number | null }).initialStopLoss !== trade.stopLoss && (
                                <span className="text-[9px] text-text-muted mt-0.5">
                                    Initial: {fmt((trade as { initialStopLoss?: number | null }).initialStopLoss!)}
                                </span>
                            )}
                        </div>
                    </Cell>
                    <Cell label="Take Profit">
                        <span className="font-mono text-[13px] font-semibold text-profit">{trade.takeProfit ? fmt(trade.takeProfit) : '—'}</span>
                    </Cell>
                    <Cell label="Entry Time">
                        <span className="text-[11px] font-semibold text-text-secondary">{entryDateStr}</span>
                    </Cell>
                    <Cell label="Exit Time">
                        <span className="text-[11px] font-semibold text-text-secondary">{exitDateStr}</span>
                    </Cell>
                    <Cell label="Duration">
                        <span className="text-[11px] font-semibold text-text-secondary">{duration ?? '—'}</span>
                    </Cell>
                    <Cell label="Volume">
                        <span className="text-[11px] font-semibold text-text-secondary">{fmtDecimals(trade.volume, 2)}</span>
                    </Cell>
                </div>

                {trade.mae && trade.mfe && (
                    <div className="space-y-1">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Excursion</div>
                        <ExcursionBar
                            mae={trade.mae}
                            mfe={trade.mfe}
                            exitDistFromEntry={exitDist ?? undefined}
                            pipLabel={isForex ? 'pips' : 'pts'}
                        />
                    </div>
                )}

                <TradePnlCurve
                    trade={{
                        entryPrice: trade.entry,
                        exitPrice: trade.exit && trade.exit > 0 ? trade.exit : null,
                        mae: trade.mae ?? null,
                        mfe: trade.mfe ?? null,
                        volume: trade.volume,
                        type: trade.type,
                        entryTime: trade.entryTime ?? null,
                        exitTime: trade.exitTime ?? null,
                    }}
                />

                <RelatedTrades
                    tradeId={trade.id}
                    relatedTradeIds={relatedTradeIds}
                    onNavigate={onNavigateTrade ?? (() => {})}
                    onLinkedChange={handleLinkedChange}
                />

                <div className="space-y-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Ratings</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Entry', field: 'entryRating' as const, value: entryRating },
                            { label: 'Exit', field: 'exitRating' as const, value: exitRating },
                            { label: 'Mgmt', field: 'managementRating' as const, value: managementRating },
                        ].map(({ label, field, value }) => (
                            <div key={field} className="flex flex-col items-center gap-1">
                                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-text-muted">{label}</span>
                                <Stars value={value} onChange={n => handleRating(field, n)} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Mood</div>
                    <div className="flex flex-wrap gap-1">
                        {MOOD_OPTIONS.map(m => {
                            const Icon = m.icon;
                            const isActive = mood === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMood(isActive ? '' : m.id)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-[0.08em] transition-all ${
                                        isActive
                                            ? `${m.bg} ${m.color} border-current`
                                            : 'bg-surface-elevated border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover'
                                    }`}
                                >
                                    <Icon size={12} />
                                    {m.id}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Plan Compliance</div>
                    <div className="flex gap-1">
                        {COMPLIANCE_OPTIONS.map(c => {
                            const isActive = compliance === c.id;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setCompliance(isActive ? '' : c.id)}
                                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.08em] transition-all ${
                                        isActive
                                            ? `${c.activeBg} ${c.color} ${c.activeBorder}`
                                            : 'bg-surface-elevated border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Strategy</div>
                    <div className="relative">
                        <button
                            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-surface-elevated border border-border-subtle rounded-lg text-[11px] text-gray-200 hover:border-border-color transition-colors"
                        >
                            <span className={selectedStrategyId ? 'text-white' : 'text-text-muted'}>
                                {selectedStrategyId
                                    ? allStrategies.find(s => s.id === selectedStrategyId)?.name ?? 'Unknown'
                                    : 'Select strategy...'}
                            </span>
                            <ChevronDown size={12} className={`transition-transform ${showStrategyDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showStrategyDropdown && (
                            <div className="absolute z-20 w-full mt-1 bg-[var(--surface-solid)] border border-border-glass rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                <button
                                    onClick={() => handleStrategyChange(null)}
                                    className={`w-full text-left px-3 py-2 text-[11px] hover:bg-surface-hover transition-colors ${!selectedStrategyId ? 'text-primary' : 'text-text-muted'}`}
                                >
                                    No strategy
                                </button>
                                {allStrategies.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleStrategyChange(s.id)}
                                        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-surface-hover transition-colors ${selectedStrategyId === s.id ? 'text-primary' : 'text-text-secondary'}`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {selectedStrategyId && strategy?.checklist?.items && strategy.checklist.items.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">
                            Setup Checklist
                            {strategy.checklist.name && (
                                <span className="text-text-muted ml-1">({strategy.checklist.name})</span>
                            )}
                        </div>
                        <SetupChecklist
                            ref={checklistRef}
                            tradeId={trade.id}
                            strategyId={selectedStrategyId}
                            initialChecklist={strategy.checklist.items}
                            initialChecked={checkedItems}
                            onSave={(checked) => setCheckedItems(checked)}
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Tags</div>
                    <div className="flex flex-wrap gap-1">
                        {allTags.map(tag => {
                            const isSelected = selectedTagIds.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => handleToggleTag(tag.id)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-[0.08em] border transition-all ${
                                        isSelected
                                            ? 'bg-surface-hover border-border-color'
                                            : 'bg-surface-elevated border-border-subtle text-text-muted hover:text-text-primary hover:border-border-color'
                                    }`}
                                    style={isSelected && tag.color ? { color: tag.color, borderColor: tag.color + '40' } : {}}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setShowTagInput(!showTagInput)}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-[0.08em] border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-color transition-all flex items-center gap-1"
                        >
                            <Plus size={9} /> New
                        </button>
                    </div>
                    {showTagInput && (
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="text"
                                value={newTagName}
                                onChange={e => setNewTagName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateTag();
                                    }
                                }}
                                placeholder="Tag name..."
                                className="flex-1 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-lg text-[11px] text-white placeholder-gray-600 focus:border-primary/40 focus:outline-none"
                                autoFocus
                            />
                            <button
                                onClick={handleCreateTag}
                                disabled={!newTagName.trim()}
                                className="px-2 py-1 bg-primary/20 border border-primary/30 rounded-lg text-primary text-[10px] font-bold hover:bg-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => { setShowTagInput(false); setNewTagName(''); }}
                                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Notes</div>
                    <RichTextEditor
                        value={notes}
                        onChange={setNotes}
                        placeholder="Add notes about this trade..."
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={update.isPending}
                    className="w-full h-10 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                    {update.isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <ShareTradeModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                tradeId={trade.id}
                symbol={trade.symbol}
                direction={trade.type}
                pnl={trade.pnl}
            />
        </div>
    );
}
