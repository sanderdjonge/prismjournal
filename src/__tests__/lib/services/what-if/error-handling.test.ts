import { describe, it, expect, vi } from 'vitest';
import { safeExternalCall, handlePartialResults, logPartialFailure } from '@/lib/services/what-if/error-handling';

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Error Handling', () => {
  describe('safeExternalCall', () => {
    it('should return success result when operation succeeds', async () => {
      const result = await safeExternalCall(
        () => Promise.resolve({ data: 'test' }),
        { data: 'fallback' },
        'test'
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'test' });
      expect(result.error).toBeUndefined();
    });
    
    it('should return fallback with error when operation fails', async () => {
      const result = await safeExternalCall(
        () => Promise.reject(new Error('API rate limit exceeded')),
        { data: 'fallback' },
        'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual({ data: 'fallback' });
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
    });
    
    it('should detect network errors', async () => {
      const result = await safeExternalCall(
        () => Promise.reject(new Error('network timeout')),
        { data: 'fallback' },
        'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.retryable).toBe(true);
    });
    
    it('should handle unknown errors', async () => {
      const result = await safeExternalCall(
        () => Promise.reject(new Error('something weird')),
        { data: 'fallback' },
        'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.retryable).toBe(false);
    });
    
    it('should handle non-Error rejections', async () => {
      const result = await safeExternalCall(
        () => Promise.reject('string error'),
        { data: 'fallback' },
        'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual({ data: 'fallback' });
    });
  });
  
  describe('handlePartialResults', () => {
    it('should separate fulfilled and rejected promises', () => {
      const results: PromiseSettledResult<string>[] = [
        { status: 'fulfilled', value: 'success1' },
        { status: 'rejected', reason: new Error('failed') },
        { status: 'fulfilled', value: 'success2' },
      ];
      
      const { successful, failed } = handlePartialResults(results);
      
      expect(successful).toEqual(['success1', 'success2']);
      expect(failed).toBe(1);
    });
    
    it('should handle all fulfilled', () => {
      const results: PromiseSettledResult<string>[] = [
        { status: 'fulfilled', value: 'success1' },
        { status: 'fulfilled', value: 'success2' },
      ];
      
      const { successful, failed } = handlePartialResults(results);
      
      expect(successful).toEqual(['success1', 'success2']);
      expect(failed).toBe(0);
    });
    
    it('should handle all rejected', () => {
      const results: PromiseSettledResult<string>[] = [
        { status: 'rejected', reason: new Error('failed1') },
        { status: 'rejected', reason: new Error('failed2') },
      ];
      
      const { successful, failed } = handlePartialResults(results);
      
      expect(successful).toEqual([]);
      expect(failed).toBe(2);
    });
    
    it('should handle empty array', () => {
      const results: PromiseSettledResult<string>[] = [];
      
      const { successful, failed } = handlePartialResults(results);
      
      expect(successful).toEqual([]);
      expect(failed).toBe(0);
    });
  });
  
  describe('logPartialFailure', () => {
    it('should not throw', () => {
      // Just verify it doesn't throw
      expect(() => logPartialFailure('test', 2, 5)).not.toThrow();
      expect(() => logPartialFailure('test', 0, 5)).not.toThrow();
    });
  });
});