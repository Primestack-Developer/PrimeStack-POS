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
  amount:           number;   // actual amount (e.g. 10.50)
  currency:         string;   // "usd", "aed", "eur"
  payment_method_id: string;  // pm_xxx from Stripe — created by Android app
  description?:     string;
  transaction_id:   string;
}

export interface StripeChargeResult {
  success:    boolean;
  charge_id?: string;
  status?:    string;
  error?:     string;
  amount?:    number;
  currency?:  string;
}

/**
 * Charge a card via Stripe using a PaymentMethod token (pm_xxx).
 * The token is created by the Android app using the Stripe SDK —
 * raw card data never touches our server.
 */
export async function chargeCardWithStripe(
  req: StripeChargeRequest
): Promise<StripeChargeResult> {
  try {
    const stripe = getStripe();
    const amountInSmallestUnit = Math.round(req.amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:         amountInSmallestUnit,
      currency:       req.currency.toLowerCase(),
      payment_method: req.payment_method_id,
      confirm:        true,
      description:    req.description || `PrimeStack POS — ${req.transaction_id}`,
      metadata:       { transaction_id: req.transaction_id },
      payment_method_options: {
        card: { moto: true }
      },
      automatic_payment_methods: {
        enabled:         true,
        allow_redirects: "never"
      }
    });

    if (paymentIntent.status === "succeeded") {
      return {
        success:   true,
        charge_id: paymentIntent.id,
        status:    "APPROVED",
        amount:    req.amount,
        currency:  req.currency
      };
    }

    return {
      success:   false,
      charge_id: paymentIntent.id,
      status:    paymentIntent.status,
      error:     `Payment status: ${paymentIntent.status}`
    };

  } catch (err: any) {
    const msg = err?.raw?.message || err?.message || "Stripe charge failed";
    console.error(`[Stripe] Charge failed for ${req.transaction_id}:`, msg);
    return { success: false, error: msg };
  }
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
