import Stripe from "stripe";
import { Request, Response } from "express";
import { TransactionModel } from "../models/transaction.js";
import { MerchantModel } from "../models/merchant.js";
import { creditWallet } from "../logic/wallet.js";
import { PayoutRequestModel } from "../models/wallet.js";

// ─────────────────────────────────────────────────────────────
// Stripe Webhook Handler
//
// Stripe calls this endpoint when:
//   • payment_intent.succeeded    → real money charged, credit wallet
//   • payment_intent.failed       → charge failed, mark transaction declined
//   • charge.refunded             → refund processed
//   • payment_intent.canceled     → payment canceled
//
// IMPORTANT: Stripe sends a signature header to verify the webhook
// is genuinely from Stripe. Always verify before processing.
// ─────────────────────────────────────────────────────────────

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig     = req.headers["stripe-signature"] as string;
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia"
    });
    // req.body must be raw Buffer — handled by express.raw() middleware
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const txId = pi.metadata?.transaction_id;

        if (txId) {
          // Find transaction in our DB
          const tx = await TransactionModel.findOne({ transaction_id: txId });
          if (tx) {
            // Update result with confirmed Stripe payment
            await TransactionModel.updateOne(
              { transaction_id: txId },
              {
                "result.status":         "APPROVED",
                "result.code":           "00",
                "result.description":    "Payment confirmed by Stripe",
                "metadata.stripe_pi_id": pi.id,
                "metadata.stripe_confirmed": true
              }
            );

            // Credit merchant wallet if not already credited
            if (!(tx.metadata as any)?.stripe_confirmed) {
              const merchant = await MerchantModel.findOne({
                merchant_id: tx.merchant?.merchant_id
              });
              const amount   = (pi.amount_received / 100); // convert from cents
              const currency = pi.currency?.toUpperCase() || "USD";

              await creditWallet(
                tx.merchant?.merchant_id || "",
                merchant?.name || tx.merchant?.merchant_id || "",
                amount,
                currency,
                txId,
                `Stripe confirmed — ${pi.id}`
              );

              console.log(`[Stripe Webhook] Wallet credited: ${amount} ${currency} for ${txId}`);
            }
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const txId = pi.metadata?.transaction_id;

        if (txId) {
          await TransactionModel.updateOne(
            { transaction_id: txId },
            {
              "result.status":      "DECLINED",
              "result.code":        "05",
              "result.description": pi.last_payment_error?.message || "Payment failed"
            }
          );
          console.log(`[Stripe Webhook] Transaction declined: ${txId}`);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const txId   = charge.payment_intent as string;

        // Find by Stripe PI id
        const tx = await TransactionModel.findOne({
          "metadata.stripe_pi_id": txId
        });
        if (tx) {
          await TransactionModel.updateOne(
            { "metadata.stripe_pi_id": txId },
            { "result.status": "REFUNDED" }
          );
          console.log(`[Stripe Webhook] Refund confirmed for PI: ${txId}`);
        }
        break;
      }

      case "payment_intent.canceled": {
        const pi   = event.data.object as Stripe.PaymentIntent;
        const txId = pi.metadata?.transaction_id;
        if (txId) {
          await TransactionModel.updateOne(
            { transaction_id: txId },
            { "result.status": "DECLINED", "result.description": "Payment canceled" }
          );
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    res.json({ received: true });

  } catch (err: any) {
    console.error("[Stripe Webhook] Processing error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
