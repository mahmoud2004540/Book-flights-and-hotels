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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
