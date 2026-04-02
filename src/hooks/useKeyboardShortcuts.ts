/**
 * useKeyboardShortcuts Hook
 *
 * Provides global keyboard shortcuts for navigation.
 * Shortcuts:
 * - j: Go to Journal
 * - d: Go to Dashboard
 * - a: Go to Analytics
 * - p: Go to Performance
 * - n: New trade (opens modal)
 * - ?: Show shortcuts help
 * - Esc: Close modal
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcutsOptions {
    onNewTrade?: () => void;
    onCloseModal?: () => void;
    onShowHelp?: () => void;
    enabled?: boolean;
}

interface Shortcut {
    key: string;
    description: string;
    action: () => void;
    modifiers?: {
        ctrl?: boolean;
        shift?: boolean;
        alt?: boolean;
    };
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
    const { onNewTrade, onCloseModal, onShowHelp, enabled = true } = options;
    const router = useRouter();

    const shortcuts: Shortcut[] = [
        {
            key: 'j',
            description: 'Go to Journal',
            action: () => router.push('/journal'),
        },
        {
            key: 'd',
            description: 'Go to Dashboard',
            action: () => router.push('/'),
        },
        {
            key: 'a',
            description: 'Go to Analytics',
            action: () => router.push('/analytics'),
        },
        {
            key: 'p',
            description: 'Go to Performance',
            action: () => router.push('/performance'),
        },
        {
            key: 'n',
            description: 'New trade',
            action: () => onNewTrade?.(),
        },
        {
            key: '?',
            description: 'Show shortcuts',
            action: () => onShowHelp?.(),
        },
        {
            key: 'Escape',
            description: 'Close modal',
            action: () => onCloseModal?.(),
        },
    ];

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            const target = event.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                // Allow Escape in inputs
                if (event.key !== 'Escape') return;
            }

            const matchingShortcut = shortcuts.find((s) => {
                if (s.key !== event.key) return false;

                // Check modifiers
                const ctrlMatch = s.modifiers?.ctrl ? event.ctrlKey || event.metaKey : true;
                const shiftMatch = s.modifiers?.shift ? event.shiftKey : !event.shiftKey;
                const altMatch = s.modifiers?.alt ? event.altKey : !event.altKey;

                return ctrlMatch && shiftMatch && altMatch;
            });

            if (matchingShortcut) {
                event.preventDefault();
                matchingShortcut.action();
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);

    return {
        shortcuts: shortcuts.map((s) => ({
            key: s.key,
            description: s.description,
            modifiers: s.modifiers,
        })),
    };
}

export const SHORTCUTS_LIST = [
    { key: 'J', description: 'Go to Journal' },
    { key: 'D', description: 'Go to Dashboard' },
    { key: 'A', description: 'Go to Analytics' },
    { key: 'P', description: 'Go to Performance' },
    { key: 'N', description: 'New trade' },
    { key: '?', description: 'Show shortcuts' },
    { key: 'Esc', description: 'Close modal' },
];