import { SupplierError } from "../errors";

/**
 * Caps how long one supplier call may take.
 *
 * The abort signal is passed down to fetch so the socket is actually closed —
 * a promise race alone would leave the request running and holding a
 * connection until the supplier eventually answered.
 */
export async function withTimeout<T>(
  supplierId: string,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new SupplierError(supplierId, "timeout", `Timed out after ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
