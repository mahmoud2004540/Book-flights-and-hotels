import { NextResponse } from "next/server";
import { ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { flightSearchSchema } from "@/lib/validation/search";
import { toFieldErrors } from "@/lib/validation/errors";
import { checkSearchLimit, clientIp } from "@/server/rate-limit";
import { searchFlights } from "@/server/suppliers/orchestrator";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = flightSearchSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, fieldErrors: toFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const verdict = checkSearchLimit(clientIp(request), userId);
  if (!verdict.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many searches. Give it a moment." },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }

  const started = Date.now();

  try {
    const outcome = await searchFlights(parsed.data);
    const durationMs = Date.now() - started;

    // Recorded for the admin statistics in stage 7. Fire-and-forget: a failed
    // analytics write must not fail the search itself.
    void prisma.search
      .create({
        data: {
          userId,
          type: ServiceType.FLIGHT,
          params: parsed.data,
          resultsCount: outcome.offers.length,
          durationMs,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      ok: true,
      offers: outcome.offers,
      meta: {
        count: outcome.offers.length,
        durationMs,
        fromCache: outcome.fromCache,
        suppliersQueried: outcome.suppliersQueried,
        suppliersSucceeded: outcome.suppliersSucceeded,
        // True when at least one supplier failed, so the page can say the
        // results may be incomplete instead of implying they are the whole market.
        partial:
          outcome.suppliersQueried > 0 &&
          outcome.suppliersSucceeded < outcome.suppliersQueried,
      },
    });
  } catch (error) {
    console.error("Flight search failed:", error);
    return NextResponse.json(
      { ok: false, message: "We could not reach our suppliers. Try again in a moment." },
      { status: 502 },
    );
  }
}
