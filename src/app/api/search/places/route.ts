import { NextResponse } from "next/server";
import { CACHE_TTL_SECONDS } from "@/lib/config";
import { placesSearchSchema } from "@/lib/validation/search";
import { checkSearchLimit, clientIp } from "@/server/rate-limit";
import { cacheKey, readCache, writeCache } from "@/server/suppliers/cache";
import { autocompleteAdapter } from "@/server/suppliers/registry";
import type { NormalizedPlace } from "@/server/suppliers/types";

/** Airport and city lookup for the search box — section 4.1. */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = placesSearchSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: true, places: [] });
  }

  const verdict = checkSearchLimit(clientIp(request), null);
  if (!verdict.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }

  const { q, kind } = parsed.data;
  const key = cacheKey("places", { q: q.toLowerCase(), kind });

  const cached = await readCache<NormalizedPlace[]>(key);
  if (cached) return NextResponse.json({ ok: true, places: cached });

  const adapter = await autocompleteAdapter();
  if (!adapter) {
    return NextResponse.json({ ok: true, places: [] });
  }

  try {
    const places = await adapter.autocomplete(q, kind);
    // Airport names and codes effectively never change, so this is cached for
    // a day rather than the minutes a fare search gets.
    await writeCache(key, adapter.id, places, CACHE_TTL_SECONDS.places);
    return NextResponse.json({ ok: true, places });
  } catch (error) {
    console.error("Autocomplete failed:", error);
    // An empty list degrades the field to free typing rather than blocking the
    // search box behind an error the traveller cannot act on.
    return NextResponse.json({ ok: true, places: [] });
  }
}
