// src/components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="glass-card p-12 max-w-md text-center space-y-4">
                        <p className="text-4xl">⚠️</p>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                            Something went wrong
                        </h2>
                        <p className="text-gray-500 text-sm font-bold">
                            {this.state.error?.message ?? 'An unexpected error occurred.'}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: undefined })}
                            className="mt-4 px-6 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/20 transition-all"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
