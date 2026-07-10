import crypto from "crypto";
import { TransactionModel } from "../models/transaction.js";

// ─────────────────────────────────────────────────────────────
// STN (Settlement Transaction Number) — Receipt Code System
//
// Flow:
//   1. Customer pays on POS → transaction approved
//   2. A unique 6-digit STN code is generated and stored
//      with the transaction in the DB
//   3. The STN code prints on the receipt
//   4. Merchant keeps the receipt
//   5. When merchant requests payout, they provide the STN code
//   6. Admin verifies: STN matches merchant + amount in DB
//   7. Admin approves → funds transfer
//
// The STN code is proof-of-transaction — it cannot be faked
// without a real approved transaction in the system.
// ─────────────────────────────────────────────────────────────

/**
 * Generate a 6-digit numeric STN code.
 * Stored with the transaction record.
 */
export function generateSTN(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Look up a transaction by STN code and merchant_id.
 * Returns the transaction if found and valid for payout.
 * Returns null if not found, already used, or wrong merchant.
 */
export async function verifySTN(
  stn_code: string,
  merchant_id: string
): Promise<{
  valid: boolean;
  transaction_id?: string;
  amount?: number;
  currency?: string;
  reason?: string;
}> {
  // Find transaction with this STN code
  const tx = await TransactionModel.findOne({
    "metadata.stn_code": stn_code,
    "merchant.merchant_id": merchant_id,
    "result.status": "APPROVED",
    "message_type": "SALE"
  });

  if (!tx) {
    return {
      valid: false,
      reason: "STN code not found or does not match this merchant"
    };
  }

  // Check if STN has already been used for a payout
  if ((tx.metadata as any)?.stn_used) {
    return {
      valid: false,
      reason: "This STN code has already been used for a payout"
    };
  }

  return {
    valid: true,
    transaction_id: tx.transaction_id ?? undefined,
    amount:         tx.amount?.value   ?? undefined,
    currency:       tx.amount?.currency ?? undefined
  };
}

/**
 * Mark an STN code as used after a payout is approved.
 * Prevents the same code being used twice.
 */
export async function markSTNUsed(stn_code: string): Promise<void> {
  await TransactionModel.updateOne(
    { "metadata.stn_code": stn_code },
    {
      $set: {
        "metadata.stn_used":    true,
        "metadata.stn_used_at": new Date().toISOString()
      }
    }
  );
}
