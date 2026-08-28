import Stripe from "stripe";
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
 * Stripe via Payment Intents — section 5.
 *
 * Card details never reach our servers: the browser sends them straight to
 * Stripe through Elements, which is what keeps us inside PCI-DSS SAQ-A.
 * 3-D Secure is handled by Stripe's automatic authentication.
 */

/** Stripe works in minor units, so a decimal string has to be converted. */
function toMinorUnits(amount: string): number {
  return Math.round(Number(amount) * 100);
}

function fromMinorUnits(amount: number): string {
  return (amount / 100).toFixed(2);
}

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe";
  private readonly client: Stripe;
  private readonly webhookSecret: string | undefined;

  constructor(secretKey: string, webhookSecret: string | undefined) {
    this.client = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
  }

  static create(): StripeProvider | null {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new StripeProvider(key, process.env.STRIPE_WEBHOOK_SECRET);
  }

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const intent = await this.client.paymentIntents.create(
      {
        amount: toMinorUnits(request.amount),
        currency: request.currency.toLowerCase(),
        receipt_email: request.customerEmail,
        // Carried on the intent so a webhook can find the booking without a
        // lookup table, and so it is visible in the Stripe dashboard.
        metadata: { bookingId: request.bookingId, reference: request.reference },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: request.idempotencyKey },
    );

    if (!intent.client_secret) {
      throw new PaymentError("provider", "Stripe returned an intent with no client secret");
    }

    return { providerRef: intent.id, clientSecret: intent.client_secret };
  }

  async getStatus(providerRef: string): Promise<PaymentStatusResult> {
    const intent = await this.client.paymentIntents.retrieve(providerRef);

    const status: PaymentStatusResult["status"] =
      intent.status === "succeeded"
        ? "succeeded"
        : intent.status === "processing"
          ? "processing"
          : intent.status === "canceled"
            ? "failed"
            : "requires_action";

    return {
      providerRef: intent.id,
      status,
      amount: fromMinorUnits(intent.amount),
      currency: intent.currency.toUpperCase(),
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const refund = await this.client.refunds.create({
      payment_intent: request.providerRef,
      amount: toMinorUnits(request.amount),
      reason: "requested_by_customer",
      metadata: { internalReason: request.reason },
    });

    return {
      refundRef: refund.id,
      status: refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending",
    };
  }

  async parseWebhook(payload: string, signature: string | null): Promise<WebhookEvent> {
    if (!this.webhookSecret) {
      throw new PaymentError("config", "STRIPE_WEBHOOK_SECRET is not set");
    }
    if (!signature) {
      throw new PaymentError("signature", "Missing Stripe signature header");
    }

    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      throw new PaymentError(
        "signature",
        `Signature verification failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    const object = event.data.object as { id?: string; payment_intent?: string };
    const providerRef = object.payment_intent ?? object.id ?? null;

    switch (event.type) {
      case "payment_intent.succeeded":
        return { id: event.id, type: "payment_succeeded", providerRef };
      case "payment_intent.payment_failed":
        return { id: event.id, type: "payment_failed", providerRef };
      case "charge.refunded":
        return { id: event.id, type: "charge_refunded", providerRef };
      default:
        return { id: event.id, type: "ignored", providerRef };
    }
  }
}
