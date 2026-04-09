'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type UserSettings = {
    displayCurrency: string;
    timezone: string;
    dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
    brokerTimezoneOffset: number;
    dashboardPeriod: '7' | '30' | '90' | '365';
    twoFAEnabled: boolean;
    isSuperuser: boolean;
};

const fetchSettings = async (): Promise<UserSettings> => {
    const res = await fetch('/api/settings');
    if (!res.ok) {
        throw new Error('Failed to fetch settings');
    }
    return res.json();
};

const updateSettings = async (data: Partial<UserSettings>): Promise<UserSettings> => {
    const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        throw new Error('Failed to update settings');
    }
    return res.json();
};

export function useSettings() {
    const queryClient = useQueryClient();
    
    const { data, error, isLoading, refetch } = useQuery<UserSettings>({
        queryKey: ['settings'],
        queryFn: fetchSettings,
        staleTime: 60000,
    });

    const mutation = useMutation({
        mutationFn: updateSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });

    return {
        settings: data,
        isLoading,
        isError: !!error,
        error,
        refetch,
        updateSettings: mutation.mutate,
        updateSettingsAsync: mutation.mutateAsync,
        isUpdating: mutation.isPending,
        displayCurrency: data?.displayCurrency ?? 'USD',
        timezone: data?.timezone ?? 'Europe/Amsterdam',
        dateFormat: data?.dateFormat ?? 'DD-MM-YYYY',
        brokerTimezoneOffset: data?.brokerTimezoneOffset ?? 0,
        dashboardPeriod: data?.dashboardPeriod ?? '30',
        twoFAEnabled: data?.twoFAEnabled ?? false,
        isSuperuser: data?.isSuperuser ?? false,
    };
}
