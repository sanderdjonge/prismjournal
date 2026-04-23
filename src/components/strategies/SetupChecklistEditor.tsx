'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChecklistItem {
    id: string;
    label: string;
    order: number;
}

interface SetupChecklistEditorProps {
    strategyId: string;
    initialChecklist?: ChecklistItem[];
    onSave?: (checklist: ChecklistItem[]) => void;
}

export function SetupChecklistEditor({ 
    strategyId, 
    initialChecklist = [], 
    onSave 
}: SetupChecklistEditorProps) {
    const [items, setItems] = useState<ChecklistItem[]>(initialChecklist);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const addItem = () => {
        if (!newItemLabel.trim()) return;
        
        const newItem: ChecklistItem = {
            id: `item_${Date.now()}`,
            label: newItemLabel.trim(),
            order: items.length,
        };
        
        setItems([...items, newItem]);
        setNewItemLabel('');
        setHasChanges(true);
    };

    const removeItem = (id: string) => {
        const filtered = items.filter(item => item.id !== id);
        // Re-order remaining items
        const reordered = filtered.map((item, index) => ({
            ...item,
            order: index,
        }));
        setItems(reordered);
        setHasChanges(true);
    };

    const updateItemLabel = (id: string, label: string) => {
        setItems(items.map(item => 
            item.id === id ? { ...item, label } : item
        ));
        setHasChanges(true);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === items.length - 1) return;
        
        const newItems = [...items];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
        
        // Update order values
        const reordered = newItems.map((item, i) => ({
            ...item,
            order: i,
        }));
        
        setItems(reordered);
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/strategies/${strategyId}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setupChecklist: items }),
            });

            if (!response.ok) throw new Error('Failed to save checklist');

            setHasChanges(false);
            onSave?.(items);
        } catch (error) {
            console.error('Failed to save checklist:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-100">Setup Checklist</h3>
                    <p className="text-xs text-text-muted">Entry criteria for this strategy</p>
                </div>
                {hasChanges && (
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
                )}
            </div>

            {/* Existing Items */}
            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="text-xs text-text-muted text-center py-4 bg-surface-elevated rounded-lg border border-border-subtle">
                        No checklist items yet. Add criteria to check before entering a trade.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div 
                            key={item.id}
                            className="flex items-center gap-2 group"
                        >
                            {/* Drag Handle + Order Controls */}
                            <div className="flex flex-col gap-0.5">
                                <button
                                    onClick={() => moveItem(index, 'up')}
                                    disabled={index === 0}
                                    className="text-text-muted hover:text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M5 2L8 6H2L5 2Z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => moveItem(index, 'down')}
                                    disabled={index === items.length - 1}
                                    className="text-text-muted hover:text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M5 8L2 4H8L5 8Z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Item Input */}
                            <input
                                type="text"
                                value={item.label}
                                onChange={(e) => updateItemLabel(item.id, e.target.value)}
                                className="flex-1 px-3 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
                                placeholder="Checklist item"
                            />

                            {/* Delete Button */}
                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Add New Item */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                    placeholder="Add new checklist item..."
                    className="flex-1 px-3 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
                />
                <button
                    onClick={addItem}
                    disabled={!newItemLabel.trim()}
                    className="px-4 py-2 bg-surface-elevated border border-border-color rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                    <Plus size={14} />
                    Add
                </button>
            </div>
        </div>
    );
}