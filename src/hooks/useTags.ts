// src/hooks/useTags.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Tag {
    id: string;
    name: string;
    color?: string | null;
    _count?: { trades: number };
}

async function fetchTags(): Promise<{ tags: Tag[] }> {
    const res = await fetch('/api/tags');
    if (!res.ok) throw new Error('Failed to fetch tags');
    return res.json();
}

export function useTags() {
    return useQuery({
        queryKey: ['tags'],
        queryFn: fetchTags,
    });
}

export function useCreateTag() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; color?: string }) =>
            fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(async r => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
    });
}

export function useUpdateTag() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: { name?: string; color?: string } }) =>
            fetch(`/api/tags/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(async r => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
    });
}

export function useDeleteTag() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            fetch(`/api/tags/${id}`, { method: 'DELETE' }).then(r => {
                if (!r.ok) throw new Error('Delete failed');
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
    });
}
