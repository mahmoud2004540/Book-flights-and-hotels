import { RATE_LIMITS } from "@/lib/config";

/**
 * Sliding-window request limits — section 7.
 *
 * In memory for now, so each serverless instance keeps its own window. That is
 * weaker than the shared counter the brief specifies, and this is the one
 * module that moves to Upstash once Redis is configured. It still stops the
 * runaway client that would otherwise exhaust a supplier quota.
 */
type Window = { hits: number[]; };

const windows = new Map<string, Window>();
const WINDOW_MS = 60_000;

export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function check(key: string, limit: number): RateVerdict {
  const now = Date.now();
  const window = windows.get(key) ?? { hits: [] };

  window.hits = window.hits.filter((at) => now - at < WINDOW_MS);

  if (window.hits.length >= limit) {
    const oldest = window.hits[0] ?? now;
    windows.set(key, window);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  window.hits.push(now);
  windows.set(key, window);
  return { allowed: true };
}

export function checkSearchLimit(ip: string, userId: string | null): RateVerdict {
  const byIp = check(`ip:${ip}`, RATE_LIMITS.searchPerIpPerMinute);
  if (!byIp.allowed) return byIp;

  if (userId) return check(`user:${userId}`, RATE_LIMITS.searchPerUserPerMinute);
  return { allowed: true };
}

/** Test hook — clears all windows so cases do not leak into each other. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * The caller's address, from the forwarded header.
 *
 * This trusts the platform to set it. Behind Vercel — and any proxy that
 * terminates TLS — a client-supplied x-forwarded-for is overwritten, so the
 * first entry is the real address. Served directly, without such a proxy, this
 * header is attacker-controlled and every per-IP limit here can be sidestepped
 * by varying it, which is why the limit that has to hold is per-address and in
 * the database instead.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * The limit for endpoints that send email.
 *
 * Per IP and in memory, so it is the first line rather than the only one: a
 * serverless deployment gives each instance its own window, and an attacker
 * spread across instances gets a multiple of this. The per-address limit in
 * mail-limit.ts is the one that actually holds, because it counts rows.
 */
export function checkAuthLimit(ip: string): RateVerdict {
  return check(`auth:${ip}`, RATE_LIMITS.authPerIpPerMinute);
}
