'use client';

import { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-sm text-text-muted">Failed to load data. Please refresh the page.</p>
                </div>
            );
        }
        return this.props.children;
    }
}
