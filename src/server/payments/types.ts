import type { CurrencyCode } from "@/lib/config";

/**
 * The single payment contract, mirroring the supplier adapter pattern.
 *
 * Stripe is the implementation for stage 5; Paymob and Tap register behind the
 * same interface when their markets are turned on, with no change above this line.
 */

export type PaymentIntentRequest = {
  bookingId: string;
  reference: string;
  amount: string;
  currency: CurrencyCode;
  customerEmail: string;
  /** Reused across retries so a repeated request never creates a second charge. */
  idempotencyKey: string;
};

export type PaymentIntentResult = {
  providerRef: string;
  /** Handed to the browser to complete the payment, including any 3-D Secure step. */
  clientSecret: string;
};

export type PaymentStatusResult = {
  providerRef: string;
  status: "requires_action" | "processing" | "succeeded" | "failed";
  amount: string;
  currency: string;
};

export type RefundRequest = {
  providerRef: string;
  amount: string;
  reason: string;
};

export type RefundResult = {
  refundRef: string;
  status: "pending" | "succeeded" | "failed";
};

export type WebhookEvent = {
  id: string;
  type: "payment_succeeded" | "payment_failed" | "charge_refunded" | "ignored";
  providerRef: string | null;
};

export interface PaymentProvider {
  readonly id: string;

  createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult>;
  getStatus(providerRef: string): Promise<PaymentStatusResult>;
  refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * Verifies the signature and returns the event.
   *
   * Signature verification is the whole point: an unverified webhook endpoint
   * lets anyone who knows the URL mark any booking as paid.
   */
  parseWebhook(payload: string, signature: string | null): Promise<WebhookEvent>;
}

export class PaymentError extends Error {
  readonly kind: "config" | "declined" | "provider" | "signature";

  constructor(kind: PaymentError["kind"], message: string) {
    super(message);
    this.name = "PaymentError";
    this.kind = kind;
  }
}
