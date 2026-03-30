import { useQuery } from '@tanstack/react-query';

export interface Strategy {
    id: string;
    name: string;
    _count?: { trades: number };
}

async function fetchStrategies(): Promise<{ strategies: Strategy[] }> {
    const res = await fetch('/api/strategies');
    if (!res.ok) throw new Error('Failed to fetch strategies');
    return res.json();
}

export function useStrategies() {
    return useQuery({
        queryKey: ['strategies'],
        queryFn: fetchStrategies,
    });
}