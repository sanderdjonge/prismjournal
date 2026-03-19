'use client';

import { useQuery } from '@tanstack/react-query';

type UserSettings = {
    displayCurrency: string;
    timezone: string;
    dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
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

export function useSettings() {
    const { data, error, isLoading, refetch } = useQuery<UserSettings>({
        queryKey: ['settings'],
        queryFn: fetchSettings,
        staleTime: 60000, // Cache for 1 minute
    });

    return {
        settings: data,
        isLoading,
        isError: !!error,
        error,
        refetch,
        // Convenience accessors with defaults
        displayCurrency: data?.displayCurrency ?? 'USD',
        timezone: data?.timezone ?? 'Europe/Amsterdam',
        dateFormat: data?.dateFormat ?? 'DD-MM-YYYY',
        twoFAEnabled: data?.twoFAEnabled ?? false,
        isSuperuser: data?.isSuperuser ?? false,
    };
}
