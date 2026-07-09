import mongoose from "mongoose";
import { OfflineWalletStatus } from "../types/wallet.js";

// ─────────────────────────────────────────────────────────────
// OfflineWalletModel
//
// Tracks the wallet debit state for every offline cash-out.
// One record per cash-out transaction.
// This is the single source of truth for whether money has
// left the customer's wallet.
// ─────────────────────────────────────────────────────────────

const OfflineWalletSchema = new mongoose.Schema({
  transaction_id:  { type: String, required: true, unique: true },
  idempotency_key: { type: String, required: true, unique: true }, // SHA-256 of tx_id+amount+user_id
  server_id:       { type: String, required: true },
  user_id:         { type: String, required: true },
  terminal_id:     { type: String, required: true },

  amount:   { type: Number, required: true },
  currency: { type: String, default: "AED" },

  status: {
    type:    String,
    default: "CREATED",
    enum:    ["CREATED", "DEBIT_SENT", "DEBIT_CONFIRMED", "DEBIT_FAILED", "VOID_SENT", "VOID_CONFIRMED", "VOID_FAILED"]
  },

  issuer_reference: String,
  issuer_error:     String,
  balance_after:    Number,
  attempts:         { type: Number, default: 0 },

  created_at:    { type: Date, default: Date.now },
  sent_at:       Date,
  confirmed_at:  Date,
  voided_at:     Date
});

export const OfflineWalletModel = mongoose.model("OfflineWallet", OfflineWalletSchema);
