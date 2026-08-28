import { prisma } from "@/lib/prisma";

/**
 * Records every supplier call — section 3.3.
 *
 * Deliberately fire-and-forget: a failure to write a log line must never turn
 * a working search into a failed one. Losing a log row is cheaper than losing
 * the response the traveller was waiting for.
 */
export function logSupplierCall(entry: {
  supplierId: string;
  endpoint: string;
  durationMs: number;
  statusCode?: number;
  error?: string;
}): void {
  void prisma.supplierLog
    .create({
      data: {
        supplierId: entry.supplierId,
        endpoint: entry.endpoint,
        durationMs: entry.durationMs,
        statusCode: entry.statusCode ?? null,
        error: entry.error?.slice(0, 500) ?? null,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to write supplier log:", error);
    });
}
