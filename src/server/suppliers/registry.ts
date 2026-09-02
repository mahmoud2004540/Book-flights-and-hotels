import { prisma } from "@/lib/prisma";
import type { SupplierAdapter } from "./types";
import { AmadeusAdapter } from "./amadeus/adapter";
import { DuffelAdapter } from "./duffel/adapter";

/**
 * Decides which adapters are live for this request.
 *
 * Two gates have to agree: the supplier must be enabled in the database, and
 * its credentials must be present. A supplier enabled without credentials is
 * skipped rather than failing every search with an auth error.
 */

let activeIds: { ids: Set<string>; loadedAt: number } | null = null;
const ACTIVE_CACHE_MS = 30_000;

async function activeSupplierIds(): Promise<Set<string>> {
  if (activeIds && Date.now() - activeIds.loadedAt < ACTIVE_CACHE_MS) return activeIds.ids;

  const rows = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { priority: "asc" },
  });

  const ids = new Set(rows.map((row) => row.id));
  activeIds = { ids, loadedAt: Date.now() };
  return ids;
}

/** Test hook — drops the cached list so a change takes effect immediately. */
export function clearRegistryCache(): void {
  activeIds = null;
}

/**
 * The mock adapter is only ever constructed here, behind an explicit flag.
 * getServerEnv() refuses to start when that flag is true in production, so
 * fixture data cannot reach a traveller (section 15).
 */
async function mockAdapter(): Promise<SupplierAdapter | null> {
  if (process.env.SUPPLIER_MOCK_ENABLED !== "true") return null;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPPLIER_MOCK_ENABLED must never be true in production.");
  }

  const { MockAdapter } = await import("./mock/adapter");
  return new MockAdapter();
}

export async function flightAdapters(): Promise<SupplierAdapter[]> {
  const mock = await mockAdapter();
  if (mock) return [mock];

  const active = await activeSupplierIds();
  const adapters: SupplierAdapter[] = [];

  if (active.has("amadeus")) {
    const amadeus = AmadeusAdapter.create();
    if (amadeus) adapters.push(amadeus);
  }

  if (active.has("duffel")) {
    const duffel = DuffelAdapter.create();
    if (duffel) adapters.push(duffel);
  }

  // Travelpayouts and Booking.com register here as their stages land.
  return adapters.filter((adapter) => adapter.capabilities.flights);
}

export async function autocompleteAdapter(): Promise<SupplierAdapter | null> {
  const adapters = await flightAdapters();
  return adapters.find((adapter) => adapter.capabilities.autocomplete) ?? null;
}
