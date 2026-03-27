import { describe, it, expect } from 'vitest';
import { computeDuration, deriveListZone } from '../TradeListPanel';
import type { JournalTrade } from '@/app/journal/page';

describe('computeDuration', () => {
    it('returns null when exitTime is missing', () => {
        expect(computeDuration('2026-03-26T09:00:00.000Z', null)).toBeNull();
    });

    it('returns minutes only when < 1 hour', () => {
        expect(computeDuration('2026-03-26T09:00:00.000Z', '2026-03-26T09:23:00.000Z')).toBe('23m');
    });

    it('returns Xh Ym format', () => {
        expect(computeDuration('2026-03-26T09:00:00.000Z', '2026-03-26T11:34:00.000Z')).toBe('2h 34m');
    });

    it('returns Xh format when no remainder minutes', () => {
        expect(computeDuration('2026-03-26T09:00:00.000Z', '2026-03-26T11:00:00.000Z')).toBe('2h');
    });
});

describe('deriveListZone', () => {
    const base: Partial<JournalTrade> = {
        entry: 1.0800, exit: 1.0860, type: 'LONG', pnl: 100,
        mae: 0.0010, mfe: 0.0070,
    };

    it('returns null when mae/mfe missing', () => {
        expect(deriveListZone({ ...base, mae: null, mfe: null } as JournalTrade)).toBeNull();
    });

    it('returns Painful for losing trade', () => {
        expect(deriveListZone({ ...base, pnl: -50 } as JournalTrade)).toBe('Painful');
    });

    it('returns Clean for high-efficiency win', () => {
        // exitDist = 0.0060, eff = (0.001 + 0.006) / (0.001 + 0.007) * 100 = 87.5%
        expect(deriveListZone({ ...base, exit: 1.0860, pnl: 100 } as JournalTrade)).toBe('Clean');
    });

    it('returns EarlyOut for mid-efficiency win', () => {
        // exitDist = 0.0020, eff = (0.001 + 0.002) / (0.001 + 0.007) * 100 = 37.5%
        expect(deriveListZone({ ...base, exit: 1.0820, pnl: 30 } as JournalTrade)).toBe('EarlyOut');
    });

    it('returns Survived for low-efficiency win (barely positive)', () => {
        // exitDist = 0.0002, eff = (0.001 + 0.0002) / (0.001 + 0.007) * 100 = 15%
        expect(deriveListZone({ ...base, exit: 1.0802, pnl: 5 } as JournalTrade)).toBe('Survived');
    });
});
