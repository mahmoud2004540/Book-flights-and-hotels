import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/config";

/**
 * How many reset emails one address may receive in an hour.
 *
 * This is the limit that has to hold. /forgot-password answers identically
 * whether or not the address has an account, so without a cap anyone can put a
 * thousand messages in a stranger's inbox by posting a thousand times, from
 * anywhere. The per-IP limit in rate-limit.ts is only a first line: it lives in
 * memory, and serverless instances do not share memory.
 *
 * Counted in auth_attempts rather than by counting tokens, because issuing a
 * reset link deliberately deletes the previous one — so the tokens are always
 * a count of one and would never limit anything. The identifier is namespaced
 * so these rows cannot collide with the sign-in lockout's, which uses the bare
 * address.
 */
const WINDOW_MS = 60 * 60 * 1000;

const keyFor = (email: string) => `mail:reset:${email}`;

export async function resetMailAllowed(email: string): Promise<boolean> {
  const row = await prisma.authAttempt.findUnique({ where: { identifier: keyFor(email) } });
  if (!row) return true;

  // A count from before the window has expired along with it.
  if (row.lastFailAt.getTime() < Date.now() - WINDOW_MS) return true;

  return row.failedCount < RATE_LIMITS.resetPerAddressPerHour;
}

/** Called after a message actually goes out, so refusals do not count. */
export async function recordResetMail(email: string): Promise<void> {
  const identifier = keyFor(email);
  const now = new Date();
  const row = await prisma.authAttempt.findUnique({ where: { identifier } });

  const withinWindow = row !== null && row.lastFailAt.getTime() >= now.getTime() - WINDOW_MS;
  const count = withinWindow ? row.failedCount + 1 : 1;

  await prisma.authAttempt.upsert({
    where: { identifier },
    create: { identifier, failedCount: 1, lastFailAt: now },
    update: { failedCount: count, lastFailAt: now },
  });
}
