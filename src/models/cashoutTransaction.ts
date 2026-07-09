import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
// CashOutTransaction — separate collection for CASH_OUT records
// Keeps the main transactions collection clean; links via
// pos_reference = transaction_id on the CashOutRequest.
// ─────────────────────────────────────────────────────────────

const CashOutTransactionSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, unique: true },
  timestamp: String,

  merchant: {
    merchant_id: String,
    store_id: String,
    terminal_id: String,
    country: String,
    currency: String
  },

  amount: {
    value: Number,
    currency: String
  },

  external_issuer: {
    server_id: String,
    user_id: String,
    issuer_reference: String,   // reference returned by the external server
    balance_after: Number       // optional balance snapshot from external server
  },

  result: {
    status: String,             // APPROVED | DECLINED | ERROR
    code: String,
    description: String,
    auth_code: String,
    rrn: String,
    stan: String
  },

  security: {
    nonce: String,
    signature: String,
    algorithm: String
  },

  metadata: {
    pos_app_version: String,
    os: String,
    note: String
  },

  created_at: { type: Date, default: Date.now }
});

export const CashOutTransactionModel = mongoose.model(
  "CashOutTransaction",
  CashOutTransactionSchema
);
