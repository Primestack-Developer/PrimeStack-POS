import crypto from "crypto";
import axios from "axios";
import { OfflineWalletModel } from "../models/offlineWallet.js";
import { ExternalIssuerModel } from "../models/externalIssuer.js";
import { OfflineDebitRequest, OfflineVoidRequest } from "../types/wallet.js";

// ─────────────────────────────────────────────────────────────
// buildIdempotencyKey
// Stable, deterministic key derived from the transaction.
// The issuer uses this to detect duplicate debit requests
// and return the same response instead of debiting twice.
// ─────────────────────────────────────────────────────────────
export function buildIdempotencyKey(
  transaction_id: string,
  user_id: string,
  amount: number
): string {
  return crypto
    .createHash("sha256")
    .update(`${transaction_id}:${user_id}:${amount}`)
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────
// createOfflineWalletRecord
// Called when a CASH_OUT request is received offline.
// Creates a CREATED record — no money moved yet.
// ─────────────────────────────────────────────────────────────
export async function createOfflineWalletRecord(
  transaction_id: string,
  server_id: string,
  user_id: string,
  terminal_id: string,
  amount: number,
  currency: string
): Promise<void> {
  const idempotency_key = buildIdempotencyKey(transaction_id, user_id, amount);

  try {
    await OfflineWalletModel.create({
      transaction_id,
      idempotency_key,
      server_id,
      user_id,
      terminal_id,
      amount,
      currency,
      status: "CREATED"
    });
  } catch (err: any) {
    if (err?.code === 11000) return; // already exists — idempotent
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// syncOfflineWalletDebit
// Called by /offline/sync for each CREATED offline cash-out.
// Sends a DEBIT to the external issuer with the idempotency key.
// Handles all state transitions safely.
// ─────────────────────────────────────────────────────────────
export async function syncOfflineWalletDebit(transaction_id: string): Promise<{
  status: "DEBIT_CONFIRMED" | "DEBIT_FAILED";
  issuer_reference?: string;
  balance_after?: number;
  error?: string;
}> {
  const record = await OfflineWalletModel.findOne({ transaction_id });

  if (!record) {
    return { status: "DEBIT_FAILED", error: "Wallet record not found" };
  }

  // Already resolved — return cached result, do not call issuer again
  if (record.status === "DEBIT_CONFIRMED") {
    return {
      status:           "DEBIT_CONFIRMED",
      issuer_reference: record.issuer_reference ?? undefined,
      balance_after:    record.balance_after    ?? undefined
    };
  }
  if (record.status === "DEBIT_FAILED") {
    return { status: "DEBIT_FAILED", error: record.issuer_error ?? undefined };
  }

  // Look up the external issuer
  const issuer = await ExternalIssuerModel.findOne({
    server_id: record.server_id,
    status: "ACTIVE"
  });

  if (!issuer) {
    await OfflineWalletModel.updateOne(
      { transaction_id },
      { status: "DEBIT_FAILED", issuer_error: "Issuer not found or suspended" }
    );
    return { status: "DEBIT_FAILED", error: "Issuer not found or suspended" };
  }

  // Mark as DEBIT_SENT before calling — so if we crash mid-flight
  // we know a request was in-flight and won't send a second one
  await OfflineWalletModel.updateOne(
    { transaction_id },
    {
      status:   "DEBIT_SENT",
      sent_at:  new Date(),
      $inc:     { attempts: 1 }
    }
  );

  const payload: OfflineDebitRequest = {
    request_type:    "DEBIT",
    user_id:         record.user_id,
    amount:          record.amount,
    currency:        record.currency,
    pos_reference:   record.transaction_id,
    pos_terminal_id: record.terminal_id,
    idempotency_key: record.idempotency_key   // ← prevents double debit
  };

  try {
    const response = await axios.post(issuer.api_url, payload, {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${issuer.api_key}`,
        // Also send as header for issuers that prefer it
        "Idempotency-Key": record.idempotency_key
      },
      timeout: 15000
    });

    const data = response.data;

    if (data.approved) {
      await OfflineWalletModel.updateOne(
        { transaction_id },
        {
          status:           "DEBIT_CONFIRMED",
          confirmed_at:     new Date(),
          issuer_reference: data.issuer_reference,
          balance_after:    data.balance_after
        }
      );
      return {
        status:           "DEBIT_CONFIRMED",
        issuer_reference: data.issuer_reference,
        balance_after:    data.balance_after
      };
    } else {
      await OfflineWalletModel.updateOne(
        { transaction_id },
        {
          status:       "DEBIT_FAILED",
          issuer_error: data.message || "Declined by issuer"
        }
      );
      return { status: "DEBIT_FAILED", error: data.message };
    }

  } catch (err: any) {
    const errMsg = err.response?.data?.message || err.message || "Unknown error";

    // If issuer returned 4xx with a clear decline, mark as FAILED
    if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
      await OfflineWalletModel.updateOne(
        { transaction_id },
        { status: "DEBIT_FAILED", issuer_error: errMsg }
      );
      return { status: "DEBIT_FAILED", error: errMsg };
    }

    // Network / 5xx — revert to CREATED so the next sync retries
    await OfflineWalletModel.updateOne(
      { transaction_id },
      { status: "CREATED", issuer_error: `Retry after: ${errMsg}` }
    );
    return { status: "DEBIT_FAILED", error: `Network error — will retry: ${errMsg}` };
  }
}

// ─────────────────────────────────────────────────────────────
// voidOfflineWalletDebit
// Reverses a DEBIT_CONFIRMED wallet debit.
// Used when an operator cancels an offline cash-out that
// was approved but cash was never dispensed.
// ─────────────────────────────────────────────────────────────
export async function voidOfflineWalletDebit(transaction_id: string): Promise<{
  voided: boolean;
  error?: string;
}> {
  const record = await OfflineWalletModel.findOne({ transaction_id });

  if (!record) {
    return { voided: false, error: "Wallet record not found" };
  }

  if (record.status !== "DEBIT_CONFIRMED") {
    return {
      voided: false,
      error:  `Cannot void — current status is ${record.status}`
    };
  }

  const issuer = await ExternalIssuerModel.findOne({
    server_id: record.server_id,
    status: "ACTIVE"
  });

  if (!issuer) {
    return { voided: false, error: "Issuer not found or suspended" };
  }

  await OfflineWalletModel.updateOne({ transaction_id }, { status: "VOID_SENT" });

  const payload: OfflineVoidRequest = {
    request_type:              "VOID",
    user_id:                   record.user_id,
    amount:                    record.amount,
    currency:                  record.currency,
    pos_reference:             record.transaction_id,
    idempotency_key:           record.idempotency_key,
    original_issuer_reference: record.issuer_reference || ""
  };

  try {
    const response = await axios.post(issuer.api_url, payload, {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${issuer.api_key}`
      },
      timeout: 15000
    });

    if (response.data.approved || response.data.voided) {
      await OfflineWalletModel.updateOne(
        { transaction_id },
        { status: "VOID_CONFIRMED", voided_at: new Date() }
      );
      return { voided: true };
    } else {
      await OfflineWalletModel.updateOne(
        { transaction_id },
        { status: "VOID_FAILED", issuer_error: response.data.message }
      );
      return { voided: false, error: response.data.message };
    }
  } catch (err: any) {
    await OfflineWalletModel.updateOne(
      { transaction_id },
      { status: "VOID_FAILED", issuer_error: err.message }
    );
    return { voided: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// getWalletState
// Returns the current wallet state for a transaction.
// Used by /offline/wallet/:transaction_id endpoint.
// ─────────────────────────────────────────────────────────────
export async function getWalletState(transaction_id: string) {
  return OfflineWalletModel.findOne(
    { transaction_id },
    { __v: 0 }
  );
}
