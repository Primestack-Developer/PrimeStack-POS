import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    stripeClient = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  }
  return stripeClient;
}

export interface StripeChargeRequest {
  amount: number;
  currency: string;
  payment_method_id: string;
  description?: string;
  transaction_id: string;
}

export interface StripeChargeResult {
  success: boolean;
  charge_id?: string;
  status?: string;
  error?: string;
  amount?: number;
  currency?: string;
}

async function createCardIntent(
  req: StripeChargeRequest,
  captureMethod: "automatic" | "manual"
): Promise<StripeChargeResult> {
  try {
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(req.amount * 100),
      currency: req.currency.toLowerCase(),
      payment_method: req.payment_method_id,
      confirm: true,
      capture_method: captureMethod,
      description: req.description || `PrimeStack POS - ${req.transaction_id}`,
      metadata: { transaction_id: req.transaction_id },
      payment_method_options: { card: { moto: true } },
      automatic_payment_methods: { enabled: true, allow_redirects: "never" }
    });
    const expectedStatus = captureMethod === "manual" ? "requires_capture" : "succeeded";
    if (paymentIntent.status === expectedStatus) {
      return {
        success: true,
        charge_id: paymentIntent.id,
        status: captureMethod === "manual" ? "AUTHORIZED" : "APPROVED",
        amount: req.amount,
        currency: req.currency
      };
    }
    return { success: false, charge_id: paymentIntent.id, status: paymentIntent.status, error: `Payment status: ${paymentIntent.status}` };
  } catch (err: any) {
    const error = err?.raw?.message || err?.message || "Stripe payment failed";
    console.error(`[Stripe] Payment failed for ${req.transaction_id}:`, error);
    return { success: false, error };
  }
}

/** Charges and captures immediately. */
export function chargeCardWithStripe(req: StripeChargeRequest): Promise<StripeChargeResult> {
  return createCardIntent(req, "automatic");
}

/** Creates an authorization hold. It is not a capture. */
export function authorizeCardWithStripe(req: StripeChargeRequest): Promise<StripeChargeResult> {
  return createCardIntent(req, "manual");
}

export async function captureStripeAuthorization(paymentIntentId: string): Promise<StripeChargeResult> {
  try {
    const intent = await getStripe().paymentIntents.capture(paymentIntentId);
    return intent.status === "succeeded"
      ? { success: true, charge_id: intent.id, status: "APPROVED" }
      : { success: false, charge_id: intent.id, status: intent.status, error: `Payment status: ${intent.status}` };
  } catch (err: any) {
    return { success: false, error: err?.raw?.message || err?.message || "Stripe capture failed" };
  }
}

export async function cancelStripeAuthorization(paymentIntentId: string): Promise<StripeChargeResult> {
  try {
    const intent = await getStripe().paymentIntents.cancel(paymentIntentId);
    return intent.status === "canceled"
      ? { success: true, charge_id: intent.id, status: "VOIDED" }
      : { success: false, charge_id: intent.id, status: intent.status, error: `Payment status: ${intent.status}` };
  } catch (err: any) {
    return { success: false, error: err?.raw?.message || err?.message || "Stripe authorization cancellation failed" };
  }
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
