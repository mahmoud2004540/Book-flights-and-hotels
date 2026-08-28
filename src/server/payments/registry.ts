import type { PaymentProvider } from "./types";
import { StripeProvider } from "./stripe/provider";

/**
 * Chooses the payment provider for this request.
 *
 * The mock is only ever constructed here, behind an explicit flag that
 * getServerEnv() refuses in production — the same containment the supplier
 * mock has, for the same reason.
 */
export async function paymentProvider(): Promise<PaymentProvider | null> {
  if (process.env.PAYMENT_MOCK_ENABLED === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PAYMENT_MOCK_ENABLED must never be true in production.");
    }
    const { MockPaymentProvider } = await import("./mock/provider");
    return new MockPaymentProvider();
  }

  // Paymob and Tap register here, routed by market, when their stages land.
  return StripeProvider.create();
}
