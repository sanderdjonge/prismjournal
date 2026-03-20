import { describe, it, expect } from 'vitest';
import { normaliseSymbol, mapTimeframe } from '@/lib/symbol-normaliser';

describe('normaliseSymbol', () => {
  it('strips .pro suffix and formats forex pair', () => {
    expect(normaliseSymbol('EURUSD.pro')).toBe('EUR/USD');
  });

  it('strips .raw suffix', () => {
    expect(normaliseSymbol('GBPUSD.raw')).toBe('GBP/USD');
  });

  it('formats clean 6-char forex pair', () => {
    expect(normaliseSymbol('USDJPY')).toBe('USD/JPY');
  });

  it('formats gold XAUUSD', () => {
    expect(normaliseSymbol('XAUUSD')).toBe('XAU/USD');
  });

  it('formats XAUUSD with suffix', () => {
    expect(normaliseSymbol('XAUUSD.micro')).toBe('XAU/USD');
  });

  it('formats BTC crypto', () => {
    expect(normaliseSymbol('BTCUSD')).toBe('BTC/USD');
  });

  it('passes through index symbols unchanged', () => {
    expect(normaliseSymbol('US30')).toBe('US30');
    expect(normaliseSymbol('NAS100')).toBe('NAS100');
    expect(normaliseSymbol('DE40')).toBe('DE40');
  });

  it('handles already-slashed symbol', () => {
    expect(normaliseSymbol('EUR/USD')).toBe('EUR/USD');
  });

  it('uppercases input', () => {
    expect(normaliseSymbol('eurusd')).toBe('EUR/USD');
  });
});

describe('mapTimeframe', () => {
  it('maps MT5 timeframe codes to Twelve Data intervals', () => {
    expect(mapTimeframe('M1')).toBe('1min');
    expect(mapTimeframe('M5')).toBe('5min');
    expect(mapTimeframe('M15')).toBe('15min');
    expect(mapTimeframe('M30')).toBe('30min');
    expect(mapTimeframe('H1')).toBe('1h');
    expect(mapTimeframe('H4')).toBe('4h');
    expect(mapTimeframe('D1')).toBe('1day');
  });

  it('is case-insensitive', () => {
    expect(mapTimeframe('m15')).toBe('15min');
    expect(mapTimeframe('h1')).toBe('1h');
  });

  it('maps W1 to 1week and returns null for unknown codes', () => {
    expect(mapTimeframe('W1')).toBe('1week');
    expect(mapTimeframe('UNKNOWN')).toBeNull();
  });
});
