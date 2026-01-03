/**
 * retryHelper.ts
 * -------------------------------------
 * Retry utility with exponential backoff
 * -------------------------------------
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
  ],
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = isRetryableError(error, opts.retryableErrors);

      if (!isRetryable || attempt === opts.maxAttempts) {
        console.error(`[Retry] Failed after ${attempt} attempt(s):`, error);
        throw lastError;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs,
      );

      console.warn(
        `[Retry] Attempt ${attempt}/${opts.maxAttempts} failed. Retrying in ${delay}ms...`,
      );

      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

export function isRetryableError(
  error: unknown,
  customRetryableErrors?: string[],
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = (error as any).code;
  const errorMessage = error.message.toLowerCase();

  const defaultRetryableErrors = [
    "etimedout",
    "econnreset",
    "econnrefused",
    "enotfound",
    "eai_again",
    "econnaborted",
    "socket hang up",
    "timeout",
    "network error",
    "5",
  ];

  if (customRetryableErrors) {
    if (errorCode && customRetryableErrors.includes(errorCode)) {
      return true;
    }
  }

  for (const retryablePattern of defaultRetryableErrors) {
    if (errorMessage.includes(retryablePattern)) {
      return true;
    }
  }

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests")
  ) {
    return true;
  }

  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = isRetryableError(error, opts.retryableErrors);

      if (!isRetryable || attempt === opts.maxAttempts) {
        console.error(`[Retry] Failed after ${attempt} attempt(s):`, error);
        throw lastError;
      }

      const baseDelay = Math.min(
        opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs,
      );

      const jitter = baseDelay * 0.1 * Math.random();
      const delay = baseDelay + jitter;

      console.warn(
        `[Retry] Attempt ${attempt}/${opts.maxAttempts} failed. Retrying in ${delay.toFixed(0)}ms...`,
      );

      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
