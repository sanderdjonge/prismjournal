import { Smile, Meh, Frown, Zap, Wind } from 'lucide-react';

/**
 * Mood options matching the Prisma Mood enum.
 * Single source of truth for all mood UI across journal components.
 */
export const MOOD_OPTIONS = [
    { id: 'CALM', icon: Wind, color: 'text-profit', bg: 'bg-profit/10' },
    { id: 'CONFIDENT', icon: Zap, color: 'text-profit', bg: 'bg-profit/10' },
    { id: 'NEUTRAL', icon: Meh, color: 'text-gray-400', bg: 'bg-white/10' },
    { id: 'ANXIOUS', icon: Frown, color: 'text-loss', bg: 'bg-loss/10' },
    { id: 'FOMO', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { id: 'REVENGE', icon: Frown, color: 'text-orange-400', bg: 'bg-orange-400/10' },
] as const;

export type MoodId = (typeof MOOD_OPTIONS)[number]['id'];

/**
 * Lookup map for mood config by id.
 */
export const MOOD_CONFIG = Object.fromEntries(
    MOOD_OPTIONS.map(m => [m.id, m])
) as Record<MoodId, (typeof MOOD_OPTIONS)[number]>;

/**
 * Compact 3-option mood selector (CALM / NEUTRAL / ANXIOUS)
 * used in trade entry and edit forms.
 */
export const MOOD_SELECTOR_OPTIONS = MOOD_OPTIONS.filter(m =>
    m.id === 'CALM' || m.id === 'NEUTRAL' || m.id === 'ANXIOUS'
);

/**
 * Plan compliance options.
 */
export const COMPLIANCE_OPTIONS = [
    { id: 'FOLLOWED' as const, label: 'Followed', color: 'text-profit', activeBg: 'bg-profit/10', activeBorder: 'border-profit/40' },
    { id: 'DEVIATED' as const, label: 'Deviated', color: 'text-loss', activeBg: 'bg-loss/10', activeBorder: 'border-loss/40' },
] as const;
