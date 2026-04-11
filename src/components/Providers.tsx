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
                            toastOptions={{
                                style: {
                                    background: '#0d1117',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#ffffff',
                                },
                            }}
                        />
                    </CurrencyProvider>
                </ThemeProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
