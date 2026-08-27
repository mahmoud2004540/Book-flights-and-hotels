import { prisma } from "@/lib/prisma";

/**
 * Brute-force protection for sign-in — section 4.4.
 * Five failed attempts lock the identifier for 15 minutes.
 *
 * Counted in the database rather than in memory: serverless instances do not
 * share memory, so an in-memory counter resets on every cold start.
 * This moves to Redis in stage 2, once Upstash is wired up.
 */

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
/** A failure this old no longer counts toward the lock. */
const WINDOW_MINUTES = 15;

export type LockState = { locked: true; until: Date } | { locked: false };

export async function checkLock(identifier: string): Promise<LockState> {
  const row = await prisma.authAttempt.findUnique({ where: { identifier } });
  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    return { locked: true, until: row.lockedUntil };
  }
  return { locked: false };
}

export async function recordFailure(identifier: string): Promise<LockState> {
  const now = new Date();
  const row = await prisma.authAttempt.findUnique({ where: { identifier } });

  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  const withinWindow = row !== null && row.lastFailAt > windowStart;
  const failedCount = withinWindow ? row.failedCount + 1 : 1;

  const lockedUntil =
    failedCount >= MAX_FAILURES
      ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
      : null;

  await prisma.authAttempt.upsert({
    where: { identifier },
    update: { failedCount, lastFailAt: now, lockedUntil },
    create: { identifier, failedCount, lastFailAt: now, lockedUntil },
  });

  return lockedUntil ? { locked: true, until: lockedUntil } : { locked: false };
}

export async function clearFailures(identifier: string): Promise<void> {
  await prisma.authAttempt.deleteMany({ where: { identifier } });
}
