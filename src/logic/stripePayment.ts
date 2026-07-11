import Stripe from "stripe";

// ─────────────────────────────────────────────────────────────
// Stripe Card Charging
//
// Used for MOTO (manual card entry) payments.
// Customer's card is charged via Stripe.
// Money lands in the Stripe account, then wallet is credited.
// ─────────────────────────────────────────────────────────────

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
  amount:         number;   // in smallest currency unit (cents/fils)
  currency:       string;   // "usd", "aed", "eur" etc
  pan:            string;   // card number
  expiry_month:   string;   // "MM"
  expiry_year:    string;   // "YY" or "YYYY"
  cvv?:           string;
  cardholder_name?: string;
  description?:   string;
  transaction_id: string;
}

export interface StripeChargeResult {
  success:       boolean;
  charge_id?:    string;
  status?:       string;
  error?:        string;
  amount?:       number;
  currency?:     string;
}

/**
 * Charge a card via Stripe.
 * Creates a PaymentMethod from raw card data, then confirms a PaymentIntent.
 */
export async function chargeCardWithStripe(
  req: StripeChargeRequest
): Promise<StripeChargeResult> {
  try {
    const stripe = getStripe();

    // Convert amount to smallest unit (Stripe uses cents)
    // AED: 1 AED = 100 fils, USD: 1 USD = 100 cents
    const amountInSmallestUnit = Math.round(req.amount * 100);

    // 1. Create a PaymentMethod from raw card data
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number:    req.pan,
        exp_month: parseInt(req.expiry_month),
        exp_year:  parseInt(
          req.expiry_year.length === 2
            ? `20${req.expiry_year}`
            : req.expiry_year
        ),
        cvc: (req.cvv && req.cvv.trim().length > 0) ? req.cvv : undefined
      },
      billing_details: {
        name: req.cardholder_name || undefined
      }
    });

    // 2. Create and confirm a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               amountInSmallestUnit,
      currency:             req.currency.toLowerCase(),
      payment_method:       paymentMethod.id,
      confirm:              true,
      description:          req.description || `PrimeStack POS — ${req.transaction_id}`,
      metadata: {
        transaction_id: req.transaction_id
      },
      // MOTO transactions use off_session
      payment_method_options: {
        card: {
          moto: true
        }
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never"
      }
    });

    if (paymentIntent.status === "succeeded") {
      return {
        success:    true,
        charge_id:  paymentIntent.id,
        status:     "APPROVED",
        amount:     req.amount,
        currency:   req.currency
      };
    } else {
      return {
        success: false,
        charge_id: paymentIntent.id,
        status:  paymentIntent.status,
        error:   `Payment intent status: ${paymentIntent.status}`
      };
    }

  } catch (err: any) {
    // Stripe card errors (declined, invalid, etc.)
    const stripeError = err?.raw?.message || err?.message || "Stripe charge failed";
    console.error(`[Stripe] Charge failed for ${req.transaction_id}:`, stripeError);
    return {
      success: false,
      error:   stripeError
    };
  }
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
