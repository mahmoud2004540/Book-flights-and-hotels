import { NextResponse } from "next/server";
import { z } from "zod";
import { paymentProvider } from "@/server/payments/registry";
import { markPaymentFailed, settleBooking } from "@/server/booking/settle";

const bodySchema = z.object({ providerRef: z.string().min(1) });

/**
 * Completes a payment against the mock provider.
 *
 * TESTS ONLY. With Stripe the browser confirms through Elements and the
 * webhook drives settlement; this route exists so the same path can be
 * exercised without a live key, and it refuses to run outside mock mode.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.PAYMENT_MOCK_ENABLED !== "true") {
    return NextResponse.json({ ok: false, reason: "not_available" }, { status: 404 });
  }
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "not_available" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 422 });
  }

  const provider = await paymentProvider();
  if (!provider) {
    return NextResponse.json({ ok: false, reason: "no_provider" }, { status: 503 });
  }

  const status = await provider.getStatus(parsed.data.providerRef);

  if (status.status === "failed") {
    await markPaymentFailed(parsed.data.providerRef);
    return NextResponse.json({ ok: false, reason: "declined" }, { status: 402 });
  }
  if (status.status !== "succeeded") {
    return NextResponse.json({ ok: true, outcome: "processing" });
  }

  const outcome = await settleBooking(parsed.data.providerRef);
  return NextResponse.json({ ok: true, outcome: outcome.status });
}
