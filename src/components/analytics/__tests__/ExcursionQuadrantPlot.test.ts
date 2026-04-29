import { describe, it, expect } from 'vitest';
import { calcExitEfficiency, assignZone } from '../ExcursionQuadrantPlot';

describe('calcExitEfficiency', () => {
    it('returns 100 when exit is exactly at MFE', () => {
        // mae=10, mfe=20, exitDist=20 → (10+20)/(10+20)*100 = 100
        expect(calcExitEfficiency(10, 20, 20)).toBe(100);
    });
    it('returns 0 when exit is exactly at MAE (worst point)', () => {
        // mae=10, mfe=20, exitDist=-10 → (10-10)/(10+20)*100 = 0
        expect(calcExitEfficiency(10, 20, -10)).toBe(0);
    });
    it('clamps to [0, 100]', () => {
        expect(calcExitEfficiency(10, 20, 30)).toBe(100);  // beyond MFE → cap at 100
        expect(calcExitEfficiency(10, 20, -20)).toBe(0);   // beyond MAE → floor at 0
    });
    it('returns 50 for mid-range exit', () => {
        // mae=10, mfe=10, exitDist=0 → (10+0)/(10+10)*100 = 50
        expect(calcExitEfficiency(10, 10, 0)).toBe(50);
    });
    it('treats null MAE as 0 (no adverse excursion)', () => {
        // NULL MAE is a valid case — means no adverse excursion recorded for the trade.
        // The function treats it as 0, not null (per documented behavior).
        expect(calcExitEfficiency(null, 20, 10)).toBe(50);
    });

    it('returns null when MFE or exit distance is null', () => {
        expect(calcExitEfficiency(10, null, 10)).toBeNull();
        expect(calcExitEfficiency(10, 20, null)).toBeNull();
    });
});

describe('assignZone', () => {
    // medianMae = 15
    it('assigns Clean for low MAE + high efficiency', () => {
        expect(assignZone(10, 75, 15)).toBe('clean');
    });
    it('assigns EarlyOut for low MAE + low efficiency', () => {
        expect(assignZone(10, 30, 15)).toBe('earlyOut');
    });
    it('assigns Survived for high MAE + high efficiency', () => {
        expect(assignZone(20, 75, 15)).toBe('survived');
    });
    it('assigns Painful for high MAE + low efficiency', () => {
        expect(assignZone(20, 30, 15)).toBe('painful');
    });
    it('treats exactly 50% efficiency as high (≥50)', () => {
        expect(assignZone(10, 50, 15)).toBe('clean');
    });
});
