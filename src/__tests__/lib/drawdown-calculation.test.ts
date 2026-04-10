import { describe, it, expect } from 'vitest';
import { calculateDrawdown } from '@/lib/drawdown';

describe('Drawdown Calculation', () => {
    describe('STATIC drawdown', () => {
        it('calculates drawdown from starting balance', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'STATIC',
                accountSize: 100000,
                currentBalance: 95000,
                highWaterMark: 100000,
            });
            expect(drawdown).toBe(5); // 5%
        });

        it('returns 0 when current balance equals account size', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'STATIC',
                accountSize: 100000,
                currentBalance: 100000,
                highWaterMark: 100000,
            });
            expect(drawdown).toBe(0);
        });

        it('caps at 100% for negative balances', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'STATIC',
                accountSize: 100000,
                currentBalance: -5000,
                highWaterMark: 100000,
            });
            expect(drawdown).toBe(100);
        });
    });

    describe('TRAILING drawdown', () => {
        it('calculates drawdown from high water mark', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'TRAILING',
                accountSize: 100000,
                currentBalance: 102000,
                highWaterMark: 105000,
            });
            expect(drawdown).toBeCloseTo(2.86, 1); // (105000-102000)/105000 * 100
        });

        it('returns 0 when at high water mark', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'TRAILING',
                accountSize: 100000,
                currentBalance: 105000,
                highWaterMark: 105000,
            });
            expect(drawdown).toBe(0);
        });

        it('uses accountSize as initial high water mark when not set', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'TRAILING',
                accountSize: 100000,
                currentBalance: 98000,
                highWaterMark: null,
            });
            expect(drawdown).toBe(2); // (100000-98000)/100000 * 100
        });

        it('handles profit above starting balance', () => {
            const drawdown = calculateDrawdown({
                drawdownType: 'TRAILING',
                accountSize: 100000,
                currentBalance: 103000,
                highWaterMark: 103000,
            });
            expect(drawdown).toBe(0);
        });
    });
});
