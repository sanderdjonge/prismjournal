'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ChallengeRule = {
    type: 'MAX_DAILY_LOSS' | 'MAX_TRADES_PER_DAY' | 'MIN_RR' | 'TIME_WINDOW' | 'MAX_DRAWDOWN' | 'WIN_RATE_TARGET';
    value: number | string;
    operator?: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
};

export type TradingChallenge = {
    id: string;
    name: string;
    description: string | null;
    scope: 'GLOBAL' | 'PER_ACCOUNT';
    accountId: string | null;
    rules: ChallengeRule[];
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    daysPassed: number;
    daysFailed: number;
    totalDays: number;
    evaluationCount: number;
    createdAt: string;
};

export type ChallengeEvaluation = {
    id: string;
    challengeId: string;
    date: string;
    passed: boolean;
    failureReasons: string[] | null;
    tradeIds: string[];
};

export type ChallengeWithEvaluations = TradingChallenge & {
    evaluations: ChallengeEvaluation[];
    stats: {
        totalDays: number;
        passedDays: number;
        failedDays: number;
        successRate: number;
    };
};

export function useChallenges(activeOnly = false) {
    return useQuery({
        queryKey: ['challenges', { activeOnly }],
        queryFn: async () => {
            const url = `/api/challenges${activeOnly ? '?active=true' : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch challenges');
            return res.json() as Promise<TradingChallenge[]>;
        },
    });
}

export function useChallenge(id: string | null) {
    return useQuery({
        queryKey: ['challenge', id],
        queryFn: async () => {
            if (!id) return null;
            const res = await fetch(`/api/challenges/${id}`);
            if (!res.ok) throw new Error('Failed to fetch challenge');
            return res.json() as Promise<ChallengeWithEvaluations>;
        },
        enabled: !!id,
    });
}

type CreateChallengeData = {
    name: string;
    description?: string;
    scope?: 'GLOBAL' | 'PER_ACCOUNT';
    accountId?: string;
    rules: ChallengeRule[];
    startDate: string;
    endDate?: string;
};

export function useCreateChallenge() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: CreateChallengeData) => {
            const res = await fetch('/api/challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create challenge');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
        },
    });
}

type UpdateChallengeData = {
    name?: string;
    description?: string;
    rules?: ChallengeRule[];
    isActive?: boolean;
    endDate?: string | null;
};

export function useUpdateChallenge(id: string) {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: UpdateChallengeData) => {
            const res = await fetch(`/api/challenges/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update challenge');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
            queryClient.invalidateQueries({ queryKey: ['challenge', id] });
        },
    });
}

export function useDeleteChallenge(id: string) {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/challenges/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete challenge');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
        },
    });
}