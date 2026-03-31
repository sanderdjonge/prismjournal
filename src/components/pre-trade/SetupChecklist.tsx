'use client';

import { useState, useEffect } from 'react';
import { Check, Square, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChecklistItem {
    id: string;
    label: string;
    required?: boolean;
    order: number;
}

interface ChecklistState extends ChecklistItem {
    checked: boolean;
}

interface SetupChecklistProps {
    tradeId: string;
    strategyId: string;
    initialChecklist?: ChecklistItem[];
    initialChecked?: Record<string, boolean>;
    onSave?: (checked: Record<string, boolean>) => void;
    readOnly?: boolean;
}

export function SetupChecklist({
    tradeId,
    strategyId,
    initialChecklist = [],
    initialChecked = {},
    onSave,
    readOnly = false,
}: SetupChecklistProps) {
    const [items, setItems] = useState<ChecklistState[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        // Initialize items with checked state
        const state: ChecklistState[] = initialChecklist.map((item) => ({
            ...item,
            checked: initialChecked[item.id] ?? false,
        }));
        // Sort by order
        state.sort((a, b) => a.order - b.order);
        setItems(state);
    }, [initialChecklist, initialChecked]);

    const handleToggle = (id: string) => {
        if (readOnly) return;
        
        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, checked: !item.checked } : item
            )
        );
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!hasChanges || readOnly) return;

        setIsSaving(true);
        try {
            const checked: Record<string, boolean> = {};
            items.forEach((item) => {
                checked[item.id] = item.checked;
            });

            const response = await fetch('/api/checklist-completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId,
                    strategyId,
                    checklist: items.map(({ id, label, checked }) => ({
                        id,
                        label,
                        checked,
                    })),
                }),
            });

            if (!response.ok) throw new Error('Failed to save checklist');

            setHasChanges(false);
            onSave?.(checked);
        } catch (error) {
            console.error('Failed to save checklist:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const checkedCount = items.filter((i) => i.checked).length;
    const totalCount = items.length;
    const completionPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    if (items.length === 0) {
        return (
            <div className="text-xs text-gray-500 text-center py-4">
                No setup checklist defined for this strategy
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full transition-all duration-300",
                            completionPct === 100 ? "bg-profit" : "bg-primary"
                        )}
                        style={{ width: `${completionPct}%` }}
                    />
                </div>
                <span className="text-xs text-gray-400">
                    {checkedCount}/{totalCount}
                </span>
            </div>

            {/* Checklist Items */}
            <div className="space-y-1.5">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleToggle(item.id)}
                        disabled={readOnly}
                        className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
                            readOnly
                                ? "cursor-default"
                                : "hover:bg-white/5 cursor-pointer",
                            item.checked && "bg-white/[0.02]"
                        )}
                    >
                        {/* Checkbox */}
                        <div
                            className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                item.checked
                                    ? "bg-profit/20 border-profit text-profit"
                                    : "border-white/20 text-transparent"
                            )}
                        >
                            {item.checked ? <Check size={12} /> : <Square size={12} />}
                        </div>

                        {/* Label */}
                        <span
                            className={cn(
                                "text-xs transition-colors flex-1",
                                item.checked ? "text-gray-300" : "text-gray-400"
                            )}
                        >
                            {item.label}
                        </span>

                        {/* Required badge */}
                        {item.required && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-red-400/70 shrink-0">
                                Req
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Save Button */}
            {hasChanges && !readOnly && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={12} />
                                Save
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}