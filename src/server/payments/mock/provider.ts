import { createHash, randomUUID } from "node:crypto";
import { PaymentError } from "../types";
import type {
  PaymentIntentRequest,
  PaymentIntentResult,
  PaymentProvider,
  PaymentStatusResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from "../types";

/**
 * A stand-in payment provider for tests — TESTS ONLY.
 *
 * The registry refuses to construct this unless PAYMENT_MOCK_ENABLED is true,
 * and the environment validator rejects that value in production, so it cannot
 * take a real payment or refuse a real one.
 *
 * Outcomes are deterministic and driven by the amount, so the paths that
 * matter are reachable from a test rather than only in theory:
 *   · an amount ending in .01 is declined
 *   · an amount ending in .02 stays in processing
 *   · anything else succeeds
 */
type MockIntent = {
  providerRef: string;
  amount: string;
  currency: string;
  status: PaymentStatusResult["status"];
  refunded: string;
};

const intents = new Map<string, MockIntent>();
/** Idempotency: the same key must return the same intent, never a second one. */
const byIdempotencyKey = new Map<string, string>();

function outcomeFor(amount: string): PaymentStatusResult["status"] {
  const cents = amount.split(".")[1] ?? "00";
  if (cents === "01") return "failed";
  if (cents === "02") return "processing";
  return "succeeded";
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const existingRef = byIdempotencyKey.get(request.idempotencyKey);
    if (existingRef) {
      return { providerRef: existingRef, clientSecret: `${existingRef}_secret` };
    }

    const providerRef = `pi_mock_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    intents.set(providerRef, {
      providerRef,
      amount: request.amount,
      currency: request.currency,
      status: outcomeFor(request.amount),
      refunded: "0.00",
    });
    byIdempotencyKey.set(request.idempotencyKey, providerRef);

    return { providerRef, clientSecret: `${providerRef}_secret` };
  }

  async getStatus(providerRef: string): Promise<PaymentStatusResult> {
    const intent = intents.get(providerRef);
    if (!intent) throw new PaymentError("provider", `Unknown intent ${providerRef}`);
    return {
      providerRef,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const intent = intents.get(request.providerRef);
    if (!intent) throw new PaymentError("provider", `Unknown intent ${request.providerRef}`);

    intent.refunded = (Number(intent.refunded) + Number(request.amount)).toFixed(2);
    return { refundRef: `re_mock_${randomUUID().slice(0, 12)}`, status: "succeeded" };
  }

  /**
   * The signature is a SHA-256 of the payload and the shared secret. Not
   * Stripe's scheme, but it exercises the same rule: an unsigned or wrongly
   * signed payload is rejected before anything is marked paid.
   */
  async parseWebhook(payload: string, signature: string | null): Promise<WebhookEvent> {
    const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET ?? "mock-secret";
    const expected = createHash("sha256").update(`${secret}.${payload}`).digest("hex");

    if (!signature) throw new PaymentError("signature", "Missing signature header");
    if (signature !== expected) throw new PaymentError("signature", "Signature does not match");

    const parsed = JSON.parse(payload) as { type?: string; providerRef?: string };
    const type: WebhookEvent["type"] =
      parsed.type === "payment_succeeded" ||
      parsed.type === "payment_failed" ||
      parsed.type === "charge_refunded"
        ? parsed.type
        : "ignored";

    return { id: `evt_mock_${randomUUID().slice(0, 12)}`, type, providerRef: parsed.providerRef ?? null };
  }

  /** Test helper — signs a payload the way parseWebhook expects. */
  static sign(payload: string): string {
    const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET ?? "mock-secret";
    return createHash("sha256").update(`${secret}.${payload}`).digest("hex");
  }

  /** Test helper — how much has been refunded against an intent. */
  static refundedAmount(providerRef: string): string {
    return intents.get(providerRef)?.refunded ?? "0.00";
  }
}
