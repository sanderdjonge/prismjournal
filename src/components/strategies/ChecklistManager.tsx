'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
    useChecklists,
    useCreateChecklist,
    useUpdateChecklist,
    useDeleteChecklist,
} from '@/hooks/useChecklists';
import type { ChecklistItemData } from '@/hooks/useChecklists';

interface ItemDraft {
    id?: string;
    label: string;
    required: boolean;
    order: number;
}

function ChecklistItemEditor({
    items,
    onChange,
}: {
    items: ItemDraft[];
    onChange: (items: ItemDraft[]) => void;
}) {
    const [newLabel, setNewLabel] = useState('');

    const addItem = () => {
        if (!newLabel.trim()) return;
        onChange([
            ...items,
            { label: newLabel.trim(), required: false, order: items.length },
        ]);
        setNewLabel('');
    };

    const removeItem = (index: number) => {
        const next = items.filter((_, i) => i !== index).map((it, i) => ({ ...it, order: i }));
        onChange(next);
    };

    const updateLabel = (index: number, label: string) => {
        onChange(items.map((it, i) => (i === index ? { ...it, label } : it)));
    };

    const toggleRequired = (index: number) => {
        onChange(items.map((it, i) => (i === index ? { ...it, required: !it.required } : it)));
    };

    const moveItem = (index: number, dir: 'up' | 'down') => {
        if (dir === 'up' && index === 0) return;
        if (dir === 'down' && index === items.length - 1) return;
        const next = [...items];
        const swap = dir === 'up' ? index - 1 : index + 1;
        [next[index], next[swap]] = [next[swap], next[index]];
        onChange(next.map((it, i) => ({ ...it, order: i })));
    };

    return (
        <div className="space-y-2">
            {items.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3 bg-white/[0.02] rounded-lg border border-white/5">
                    No items yet. Add entry criteria below.
                </p>
            ) : (
                items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                        {/* Order controls */}
                        <div className="flex flex-col gap-0.5">
                            <button
                                type="button"
                                onClick={() => moveItem(index, 'up')}
                                disabled={index === 0}
                                className="text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronUp size={10} />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === items.length - 1}
                                className="text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronDown size={10} />
                            </button>
                        </div>

                        {/* Label input */}
                        <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateLabel(index, e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white/[0.02] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
                            placeholder="Item label"
                        />

                        {/* Required toggle */}
                        <button
                            type="button"
                            onClick={() => toggleRequired(index)}
                            title={item.required ? 'Mark as optional' : 'Mark as required'}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border transition-colors ${
                                item.required
                                    ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                    : 'bg-white/[0.03] border-white/10 text-gray-500 hover:text-white'
                            }`}
                        >
                            {item.required ? 'Req' : 'Opt'}
                        </button>

                        {/* Delete */}
                        <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ))
            )}

            {/* Add new item row */}
            <div className="flex gap-2 pt-1">
                <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                    placeholder="Add new item..."
                    className="flex-1 px-3 py-1.5 bg-white/[0.02] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50"
                />
                <button
                    type="button"
                    onClick={addItem}
                    disabled={!newLabel.trim()}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                    <Plus size={13} />
                    Add
                </button>
            </div>
        </div>
    );
}

interface InlineEditorProps {
    initial?: { name: string; items: ChecklistItemData[] };
    onSave: (name: string, items: Omit<ChecklistItemData, 'id'>[]) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}

function InlineEditor({ initial, onSave, onCancel, isSaving }: InlineEditorProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [items, setItems] = useState<ItemDraft[]>(
        initial?.items.map((it) => ({ id: it.id, label: it.label, required: it.required, order: it.order })) ?? []
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onSave(
            name.trim(),
            items.map((it) => ({ label: it.label, required: it.required, order: it.order }))
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Checklist Name *</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., ICT Entry Checklist"
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Items</label>
                <ChecklistItemEditor items={items} onChange={setItems} />
            </div>

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSaving || !name.trim()}
                    className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
}

export default function ChecklistManager() {
    const { data, isLoading } = useChecklists();
    const createChecklist = useCreateChecklist();
    const updateChecklist = useUpdateChecklist();
    const deleteChecklist = useDeleteChecklist();

    const [showNew, setShowNew] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const checklists = data?.checklists ?? [];

    const handleCreate = async (name: string, items: Omit<ChecklistItemData, 'id'>[]) => {
        await createChecklist.mutateAsync({ name, items });
        setShowNew(false);
    };

    const handleUpdate = async (id: string, name: string, items: Omit<ChecklistItemData, 'id'>[]) => {
        await updateChecklist.mutateAsync({ id, name, items });
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        await deleteChecklist.mutateAsync(id);
        setConfirmDeleteId(null);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Entry Checklists</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Reusable checklists you can attach to strategies</p>
                </div>
                {!showNew && (
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-sm text-primary transition-colors font-bold"
                    >
                        <Plus size={14} />
                        New Checklist
                    </button>
                )}
            </div>

            {/* Inline form for new checklist */}
            {showNew && (
                <div className="glass-card p-4 border-primary/20 bg-white/[0.03]">
                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-3">New Checklist</p>
                    <InlineEditor
                        onSave={handleCreate}
                        onCancel={() => setShowNew(false)}
                        isSaving={createChecklist.isPending}
                    />
                </div>
            )}

            {/* Checklist list */}
            {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Loading checklists...
                </div>
            ) : checklists.length === 0 && !showNew ? (
                <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-white/5">
                    <p className="text-gray-500 text-sm">No checklists yet.</p>
                    <button
                        onClick={() => setShowNew(true)}
                        className="text-primary hover:text-primary/80 text-sm font-bold mt-2 transition-colors"
                    >
                        Create your first checklist →
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {checklists.map((cl) => (
                        <div key={cl.id} className="glass-card p-4 border-white/5">
                            {editingId === cl.id ? (
                                <>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-3">Editing</p>
                                    <InlineEditor
                                        initial={cl}
                                        onSave={(name, items) => handleUpdate(cl.id, name, items)}
                                        onCancel={() => setEditingId(null)}
                                        isSaving={updateChecklist.isPending}
                                    />
                                </>
                            ) : (
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">{cl.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-gray-500">
                                                    {cl.items.length} item{cl.items.length !== 1 ? 's' : ''}
                                                </span>
                                                {(cl._count?.strategies ?? 0) > 0 && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                                        {cl._count!.strategies} strateg{cl._count!.strategies === 1 ? 'y' : 'ies'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingId(cl.id)}
                                                className="p-1.5 text-gray-500 hover:text-primary transition-colors rounded"
                                                title="Edit checklist"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(cl.id)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
                                                title="Delete checklist"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Items preview */}
                                    {cl.items.length > 0 && (
                                        <ul className="mt-3 space-y-1">
                                            {cl.items.map((item) => (
                                                <li key={item.id} className="flex items-center gap-2 text-xs text-gray-400">
                                                    <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                                                    <span className="flex-1">{item.label}</span>
                                                    {item.required && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-red-400/70">
                                                            Required
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-sm mx-4 p-6 border-red-500/20">
                        <h2 className="text-lg font-bold text-white mb-2">Delete Checklist?</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            This will remove the checklist from all strategies using it. Trade completion records are not affected.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={deleteChecklist.isPending}
                                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
                            >
                                {deleteChecklist.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
