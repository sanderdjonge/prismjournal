import { describe, it, expect } from 'vitest';
import { autoScreenshotConfigSchema } from '@/lib/validations/screenshot-config';

describe('autoScreenshotConfigSchema', () => {
  it('parses a valid config', () => {
    const result = autoScreenshotConfigSchema.safeParse({
      enabled: true,
      openTimeframes: ['M15', 'H1'],
      closeTimeframes: ['M15'],
      barsOfContext: 60,
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for missing fields', () => {
    const result = autoScreenshotConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.enabled).toBe(false);
    expect(result.data.openTimeframes).toEqual([]);
    expect(result.data.closeTimeframes).toEqual([]);
    expect(result.data.barsOfContext).toBe(60);
  });

  it('rejects invalid timeframe values', () => {
    const result = autoScreenshotConfigSchema.safeParse({
      enabled: true,
      openTimeframes: ['INVALID'],
      closeTimeframes: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects barsOfContext below 20', () => {
    const result = autoScreenshotConfigSchema.safeParse({
      enabled: true,
      openTimeframes: [],
      closeTimeframes: [],
      barsOfContext: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects barsOfContext above 200', () => {
    const result = autoScreenshotConfigSchema.safeParse({
      barsOfContext: 500,
    });
    expect(result.success).toBe(false);
  });
});
