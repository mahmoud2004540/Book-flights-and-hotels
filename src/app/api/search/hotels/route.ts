import { NextResponse } from "next/server";
import { ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hotelSearchSchema } from "@/lib/validation/search";
import { toFieldErrors } from "@/lib/validation/errors";
import { checkSearchLimit, clientIp } from "@/server/rate-limit";
import { searchHotels } from "@/server/suppliers/hotel-search";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = hotelSearchSchema.safeParse(Object.fromEntries(url.searchParams));

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
    const outcome = await searchHotels(parsed.data);
    const durationMs = Date.now() - started;

    void prisma.search
      .create({
        data: {
          userId,
          type: ServiceType.HOTEL,
          params: parsed.data,
          resultsCount: outcome.hotels.length,
          durationMs,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      ok: true,
      hotels: outcome.hotels,
      meta: {
        count: outcome.hotels.length,
        durationMs,
        fromCache: outcome.fromCache,
        partial:
          outcome.suppliersQueried > 0 &&
          outcome.suppliersSucceeded < outcome.suppliersQueried,
      },
    });
  } catch (error) {
    console.error("Hotel search failed:", error);
    return NextResponse.json(
      { ok: false, message: "We could not reach our suppliers. Try again in a moment." },
      { status: 502 },
    );
  }
}
