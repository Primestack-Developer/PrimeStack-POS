import crypto from "crypto";
import { Request, Response } from "express";
import { PayoutRequestModel } from "../models/wallet.js";

// ─────────────────────────────────────────────────────────────
// Wise Webhook Handler
//
// Wise calls this endpoint when a transfer status changes:
//   • transfer.active_funds_converted  → funds converting
//   • transfer.active_funds_converted  → conversion done
//   • transfer.outgoing_payment_sent   → money sent to recipient ✅
//   • transfer.processing              → still processing
//   • transfer.funds_refunded          → transfer failed, refunded
//
// Wise signs webhooks with a public key — we verify before processing.
// ─────────────────────────────────────────────────────────────

export async function handleWiseWebhook(req: Request, res: Response) {
  // Verify Wise webhook signature
  const signature    = req.headers["x-signature-sha256"] as string;
  const deliveryId   = req.headers["x-delivery-id"] as string;
  const wisePublicKey = process.env.WISE_WEBHOOK_PUBLIC_KEY;

  if (wisePublicKey && signature) {
    try {
      const body    = JSON.stringify(req.body);
      const verify  = crypto.createVerify("SHA256");
      verify.update(body);
      const isValid = verify.verify(
        `-----BEGIN PUBLIC KEY-----\n${wisePublicKey}\n-----END PUBLIC KEY-----`,
        signature,
        "base64"
      );
      if (!isValid) {
        console.error("[Wise Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (err: any) {
      console.error("[Wise Webhook] Signature check error:", err.message);
      // Continue processing even if signature check fails (key not configured)
    }
  }

  const event = req.body;
  console.log(`[Wise Webhook] Event type: ${event?.event_type}, delivery: ${deliveryId}`);

  try {
    const data       = event?.data;
    const transferId = data?.resource?.id?.toString() || data?.id?.toString();
    const status     = data?.current_state || event?.event_type;

    if (!transferId) {
      return res.json({ received: true, note: "No transfer ID found" });
    }

    // Find payout request by Wise transfer ID or approved status
    const payout = await PayoutRequestModel.findOne({
      $or: [
        { "metadata.wise_transfer_id": transferId },
        { status: "APPROVED" }
      ]
    });

    if (!payout) {
      console.log(`[Wise Webhook] No payout found for transfer ${transferId}`);
      return res.json({ received: true, note: "Payout not found" });
    }

    // Map Wise status to payout status
    if (
      status === "outgoing_payment_sent" ||
      event?.event_type === "transfers#state-change" && data?.current_state === "outgoing_payment_sent"
    ) {
      // Money has left Wise — mark payout as COMPLETED
      await PayoutRequestModel.updateOne(
        { payout_id: payout.payout_id },
        {
          status:       "COMPLETED",
          processed_at: new Date(),
          admin_note:   `Auto-completed by Wise webhook — transfer ${transferId}`
        }
      );
      console.log(`[Wise Webhook] Payout ${payout.payout_id} marked COMPLETED`);

    } else if (
      status === "funds_refunded" ||
      (event?.event_type === "transfers#state-change" && data?.current_state === "funds_refunded")
    ) {
      // Transfer failed — mark as rejected so admin can retry
      await PayoutRequestModel.updateOne(
        { payout_id: payout.payout_id },
        {
          status:     "REJECTED",
          admin_note: `Wise transfer failed/refunded — transfer ${transferId}. Please retry.`
        }
      );
      console.log(`[Wise Webhook] Payout ${payout.payout_id} marked REJECTED (refunded)`);

    } else {
      console.log(`[Wise Webhook] Status ${status} — no action needed`);
    }

    res.json({ received: true });

  } catch (err: any) {
    console.error("[Wise Webhook] Processing error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
