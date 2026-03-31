import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ChecklistItemData {
    id: string;
    label: string;
    required: boolean;
    order: number;
}

export interface ChecklistData {
    id: string;
    name: string;
    items: ChecklistItemData[];
    _count?: { strategies: number };
}

async function fetchChecklists(): Promise<{ checklists: ChecklistData[] }> {
    const res = await fetch('/api/checklists');
    if (!res.ok) throw new Error('Failed to fetch checklists');
    return res.json();
}

export function useChecklists() {
    return useQuery({ queryKey: ['checklists'], queryFn: fetchChecklists });
}

export function useCreateChecklist() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: { name: string; items: Omit<ChecklistItemData, 'id'>[] }) => {
            const res = await fetch('/api/checklists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create checklist');
            return res.json();
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
    });
}

export function useUpdateChecklist() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; name?: string; items?: Omit<ChecklistItemData, 'id'>[] }) => {
            const res = await fetch(`/api/checklists/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update checklist');
            return res.json();
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
    });
}

export function useDeleteChecklist() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/checklists/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete checklist');
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['checklists'] });
            qc.invalidateQueries({ queryKey: ['strategies'] });
        },
    });
}
