/**
 * A classified failure from a supplier.
 *
 * The kind decides behaviour: `rateLimited` and `unavailable` are worth
 * retrying, `invalidRequest` never is, and only failures that indicate the
 * supplier itself is unhealthy should count toward the circuit breaker.
 */
export type SupplierErrorKind =
  | "auth"
  | "rateLimited"
  | "invalidRequest"
  | "notFound"
  | "unavailable"
  | "timeout"
  | "malformedResponse";

export class SupplierError extends Error {
  readonly kind: SupplierErrorKind;
  readonly statusCode: number | undefined;
  readonly supplierId: string;

  constructor(
    supplierId: string,
    kind: SupplierErrorKind,
    message: string,
    statusCode?: number,
  ) {
    super(`[${supplierId}] ${message}`);
    this.name = "SupplierError";
    this.supplierId = supplierId;
    this.kind = kind;
    this.statusCode = statusCode;
  }

  /** Retrying only helps when the cause is transient. */
  get isRetryable(): boolean {
    return this.kind === "rateLimited" || this.kind === "unavailable" || this.kind === "timeout";
  }

  /**
   * A malformed request is our bug, not the supplier being down, so it must
   * not push the breaker toward opening and blocking healthy traffic.
   */
  get countsTowardBreaker(): boolean {
    return this.kind !== "invalidRequest" && this.kind !== "notFound";
  }
}

export function classifyStatus(status: number): SupplierErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  if (status >= 500) return "unavailable";
  return "invalidRequest";
}
