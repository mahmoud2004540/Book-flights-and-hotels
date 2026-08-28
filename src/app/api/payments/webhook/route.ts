import { NextResponse } from "next/server";
import { paymentProvider } from "@/server/payments/registry";
import { PaymentError } from "@/server/payments/types";
import { markPaymentFailed, settleBooking } from "@/server/booking/settle";

/**
 * The payment provider's webhook.
 *
 * Two rules make this endpoint safe. The signature is verified before anything
 * is read, because an unverified endpoint lets anyone who finds the URL mark a
 * booking as paid. And handling is idempotent, because providers deliver the
 * same event more than once by design.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const provider = await paymentProvider();
  if (!provider) {
    return NextResponse.json({ ok: false, reason: "no_provider" }, { status: 503 });
  }

  // Read as raw text: signature verification runs over the exact bytes sent,
  // and parsing to JSON first would change them.
  const payload = await request.text();
  const signature =
    request.headers.get("stripe-signature") ?? request.headers.get("x-mock-signature");

  let event;
  try {
    event = await provider.parseWebhook(payload, signature);
  } catch (error) {
    if (error instanceof PaymentError && error.kind === "signature") {
      console.warn("Rejected a webhook with a bad signature");
      return NextResponse.json({ ok: false, reason: "bad_signature" }, { status: 400 });
    }
    console.error("Webhook parsing failed:", error);
    return NextResponse.json({ ok: false, reason: "parse_error" }, { status: 400 });
  }

  if (!event.providerRef || event.type === "ignored") {
    // Acknowledged rather than errored: an unrecognised event is not a failure,
    // and a non-2xx makes the provider retry it forever.
    return NextResponse.json({ ok: true, handled: false });
  }

  try {
    if (event.type === "payment_succeeded") {
      const outcome = await settleBooking(event.providerRef);
      return NextResponse.json({ ok: true, handled: true, outcome: outcome.status });
    }
    if (event.type === "payment_failed") {
      await markPaymentFailed(event.providerRef);
      return NextResponse.json({ ok: true, handled: true, outcome: "failed" });
    }
    return NextResponse.json({ ok: true, handled: false });
  } catch (error) {
    // A 500 asks the provider to retry, which is what we want when our own
    // side failed rather than the event being bad.
    console.error("Webhook handling failed:", error);
    return NextResponse.json({ ok: false, reason: "handler_error" }, { status: 500 });
  }
}
