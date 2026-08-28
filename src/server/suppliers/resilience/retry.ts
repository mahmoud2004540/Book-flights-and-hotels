import { SupplierError } from "../errors";
import { SUPPLIER_TIMEOUTS } from "@/lib/config";

/**
 * Retries with exponential backoff and jitter — section 3.3.
 *
 * The jitter matters: without it, every instance that failed on the same
 * supplier outage retries at the same instant and hits it again as one wave.
 */
const BASE_DELAY_MS = 250;

function backoffDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * 2 ** attempt;
  return exponential + Math.random() * BASE_DELAY_MS;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  run: () => Promise<T>,
  attempts: number = SUPPLIER_TIMEOUTS.retryAttempts,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;

      // A non-retryable failure fails now: repeating a malformed request
      // only wastes the caller's remaining time budget.
      const retryable = error instanceof SupplierError && error.isRetryable;
      if (!retryable || attempt === attempts - 1) throw error;

      await sleep(backoffDelay(attempt));
    }
  }

  throw lastError;
}
