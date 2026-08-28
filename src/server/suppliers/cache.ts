import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Search result cache — section 7.
 *
 * Backed by the offers_cache table for now. The brief specifies Redis, and
 * this interface is the single place that changes once Upstash is configured;
 * Postgres is slower but correct, and shared across instances, which an
 * in-process map would not be.
 */

export function cacheKey(namespace: string, parts: Record<string, unknown>): string {
  // Keys are sorted so that the same search always hashes identically
  // regardless of the order the caller happened to build the object in.
  const canonical = JSON.stringify(parts, Object.keys(parts).sort());
  return `${namespace}:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

export async function readCache<T>(key: string): Promise<T | null> {
  const row = await prisma.offersCache.findUnique({ where: { cacheKey: key } });
  if (!row) return null;

  if (row.expiresAt < new Date()) {
    // Expired rows are removed on read rather than by a scheduled sweep, so a
    // stale entry can never be served even if the sweep is late.
    await prisma.offersCache.delete({ where: { cacheKey: key } }).catch(() => {
      // A concurrent request may have deleted it first. Nothing to do.
    });
    return null;
  }

  return row.payload as T;
}

export async function writeCache(
  key: string,
  supplierId: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const data = { supplierId, payload: payload as object, expiresAt };

  await prisma.offersCache
    .upsert({ where: { cacheKey: key }, update: data, create: { cacheKey: key, ...data } })
    .catch((error: unknown) => {
      // A cache write failure must not fail the search the traveller is waiting on.
      console.error("Cache write failed:", error);
    });
}
