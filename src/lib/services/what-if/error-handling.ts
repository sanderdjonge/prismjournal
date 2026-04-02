/**
 * Error Handling Utilities for What-If Simulator
 * Provides safe wrappers for external API calls and partial result handling
 */
import { logger } from '@/lib/logger';

/** Result wrapper for operations that may fail */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/** Wrap external API calls with error handling */
export async function safeExternalCall<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logger.error({ err: error, context }, 'External API error');
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for rate limiting
    if (errorMessage.includes('rate limit')) {
      return {
        success: false,
        data: fallback,
        error: {
          code: 'RATE_LIMITED',
          message: 'API rate limit exceeded. Using cached data.',
          retryable: true,
        },
      };
    }
    
    // Check for network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        data: fallback,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error. Please try again.',
          retryable: true,
        },
      };
    }
    
    return {
      success: false,
      data: fallback,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred.',
        retryable: false,
      },
    };
  }
}

/** Partial result handler for parallel operations */
export function handlePartialResults<T>(
  results: PromiseSettledResult<T>[]
): { successful: T[]; failed: number } {
  const successful = results
    .filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
    .map(r => r.value);
  
  const failed = results.filter(r => r.status === 'rejected').length;
  
  return { successful, failed };
}

/** Log warning for partial failures */
export function logPartialFailure(context: string, failed: number, total: number): void {
  if (failed > 0) {
    logger.warn({ context, failed, total }, 'Partial operation failure');
  }
}