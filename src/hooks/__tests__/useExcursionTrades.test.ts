import { describe, it, expect } from 'vitest';

// Pure helper extracted for testing — see Step 3
import { computeExitDist, mapToQuadrantTrade } from '../useExcursionTrades';

describe('computeExitDist', () => {
    it('returns exit - entry for LONG trades', () => {
        expect(computeExitDist(1.1000, 1.1050, 'LONG')).toBeCloseTo(0.0050, 5);
    });
    it('returns entry - exit for SHORT trades', () => {
        expect(computeExitDist(1.1050, 1.1000, 'SHORT')).toBeCloseTo(0.0050, 5);
    });
    it('returns null when exit is null', () => {
        expect(computeExitDist(1.1000, null, 'LONG')).toBeNull();
    });
});

describe('mapToQuadrantTrade', () => {
    const rawTrade = {
        id: 'abc',
        ticket: 'T001',
        symbol: 'EURUSD',
        direction: 'LONG',
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: -1.5,
        swap: 0,
        pnl: 50,
        entryTime: '2026-03-25T09:00:00Z',
        exitTime: '2026-03-25T10:00:00Z',
        mood: 'FOCUSED',
        planCompliance: 'FOLLOWED',
        closeReason: 'TP',
        notes: 'Good trade',
        strategy: { name: 'ICT FVG' },
        account: { name: 'FTMO' },
        accountId: 'acc1',
        mae: 0.0012,
        mfe: 0.0060,
        tags: [],
        entryRating: null,
        exitRating: null,
        managementRating: null,
        rMultiple: null,
        initialStopLoss: null,
        beTriggered: false,
        time: '2026-03-25T09:00:00Z',
        volume: 0.1,
    };

    it('maps all JournalTrade fields correctly', () => {
        const result = mapToQuadrantTrade(rawTrade);
        expect(result.id).toBe('abc');
        expect(result.symbol).toBe('EURUSD');
        expect(result.type).toBe('LONG');
        expect(result.entry).toBe(1.1000);
        expect(result.pnl).toBe(50);
        expect(result.mae).toBe(0.0012);
        expect(result.mfe).toBe(0.0060);
        expect(result.strategy).toBe('ICT FVG');
        expect(result.accountName).toBe('FTMO');
        expect(result.volume).toBe(0.1);
    });

    it('computes exitDistFromEntry correctly', () => {
        const result = mapToQuadrantTrade(rawTrade);
        expect(result.exitDistFromEntry).toBeCloseTo(0.0050, 5);
    });

    it('returns null exitDistFromEntry when exitPrice is null', () => {
        const result = mapToQuadrantTrade({ ...rawTrade, exitPrice: null });
        expect(result.exitDistFromEntry).toBeNull();
    });
});
