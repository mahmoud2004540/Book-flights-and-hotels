import { SUPPLIER_TIMEOUTS } from "@/lib/config";
import { SupplierError } from "../errors";

/**
 * Stops calling a supplier that keeps failing — section 3.3.
 * Five consecutive failures opens the circuit for 60 seconds.
 *
 * State is in memory for now, which means each serverless instance keeps its
 * own count. That is weaker than the shared state the brief asks for, but it
 * still cuts most of the wasted calls, and the interface below is what moves
 * to Redis in one place once Upstash is configured.
 */
type BreakerState = {
  consecutiveFailures: number;
  openedAt: number | null;
};

const states = new Map<string, BreakerState>();

function stateFor(supplierId: string): BreakerState {
  const existing = states.get(supplierId);
  if (existing) return existing;

  const fresh: BreakerState = { consecutiveFailures: 0, openedAt: null };
  states.set(supplierId, fresh);
  return fresh;
}

export function isOpen(supplierId: string): boolean {
  const state = stateFor(supplierId);
  if (state.openedAt === null) return false;

  const elapsed = Date.now() - state.openedAt;
  if (elapsed >= SUPPLIER_TIMEOUTS.circuitBreakerCooldownMs) {
    // Cooldown over: let one call through to test whether it recovered.
    state.openedAt = null;
    state.consecutiveFailures = 0;
    return false;
  }
  return true;
}

export function recordSuccess(supplierId: string): void {
  const state = stateFor(supplierId);
  state.consecutiveFailures = 0;
  state.openedAt = null;
}

export function recordFailure(supplierId: string, error: unknown): void {
  if (error instanceof SupplierError && !error.countsTowardBreaker) return;

  const state = stateFor(supplierId);
  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= SUPPLIER_TIMEOUTS.circuitBreakerFailures) {
    state.openedAt = Date.now();
  }
}

/** Test hook — resets state between cases so they do not leak into each other. */
export function resetBreakers(): void {
  states.clear();
}
