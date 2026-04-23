'use client';

import { SessionProvider } from 'next-auth/react';
import { CurrencyProvider } from '@/lib/currency';
import { ThemeProvider } from '@/lib/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () => new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 30_000,
                    retry: 1,
                },
            },
        })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <ThemeProvider>
                    <CurrencyProvider>
                        {children}
                        <Toaster
                            position="bottom-right"
                            closeButton
                            toastOptions={{
                                classNames: {
                                    toast: '!bg-[var(--surface-solid)] !text-[var(--text-primary)] !border-[var(--border-solid)]',
                                    description: '!text-[var(--text-secondary)]',
                                    actionButton: '!bg-primary !text-black',
                                    cancelButton: '!bg-[var(--surface-elevated)] !text-[var(--text-secondary)]',
                                    closeButton: '!bg-[var(--surface-elevated)] !text-[var(--text-secondary)] !border-[var(--border-color)]',
                                },
                            }}
                        />
                    </CurrencyProvider>
                </ThemeProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
