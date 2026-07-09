import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
// MerchantWallet
//
// One wallet per merchant. Holds the running balance.
// All money movement is tracked in WalletLedger (append-only).
// The balance here is always derived from the ledger —
// it is updated atomically with each ledger entry.
//
// status:
//   ACTIVE    — normal, can receive and request payouts
//   FROZEN    — no credits or debits allowed (fraud hold)
//   SUSPENDED — merchant account suspended
// ─────────────────────────────────────────────────────────────

const MerchantWalletSchema = new mongoose.Schema({
  merchant_id:     { type: String, required: true, unique: true },
  merchant_name:   { type: String },
  currency:        { type: String, default: "AED" },
  balance:         { type: Number, default: 0 },    // current available balance
  pending_balance: { type: Number, default: 0 },    // in transit / not yet settled
  total_credited:  { type: Number, default: 0 },    // lifetime credits
  total_debited:   { type: Number, default: 0 },    // lifetime debits (payouts)
  status: {
    type:    String,
    default: "ACTIVE",
    enum:    ["ACTIVE", "FROZEN", "SUSPENDED"]
  },
  bank_account: {
    account_name:   String,
    account_number: String,
    bank_name:      String,
    iban:           String,
    swift:          String,
    country:        String
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const MerchantWalletModel = mongoose.model("MerchantWallet", MerchantWalletSchema);

// ─────────────────────────────────────────────────────────────
// WalletLedger — append-only audit trail of every movement
//
// type:
//   CREDIT        — payment received (MOTO sale approved)
//   DEBIT         — payout to merchant bank
//   REFUND        — refund reversed from balance
//   FEE           — platform fee deducted
//   REVERSAL      — correction entry
// ─────────────────────────────────────────────────────────────

const WalletLedgerSchema = new mongoose.Schema({
  merchant_id:    { type: String, required: true, index: true },
  transaction_id: { type: String, required: true, unique: true }, // 101.6 or payout ref
  type: {
    type:     String,
    required: true,
    enum:     ["CREDIT", "DEBIT", "REFUND", "FEE", "REVERSAL"]
  },
  amount:          { type: Number, required: true },   // always positive
  currency:        { type: String, default: "AED" },
  balance_before:  { type: Number, required: true },   // wallet balance before this entry
  balance_after:   { type: Number, required: true },   // wallet balance after this entry
  description:     { type: String },
  reference:       { type: String },                   // external reference if any
  created_at:      { type: Date, default: Date.now }
});

export const WalletLedgerModel = mongoose.model("WalletLedger", WalletLedgerSchema);

// ─────────────────────────────────────────────────────────────
// PayoutRequest — merchant requests to withdraw to bank
//
// status:
//   PENDING    — submitted, awaiting admin review
//   APPROVED   — admin approved, bank transfer initiated
//   COMPLETED  — bank confirms transfer done
//   REJECTED   — admin rejected (insufficient balance, etc.)
// ─────────────────────────────────────────────────────────────

const PayoutRequestSchema = new mongoose.Schema({
  payout_id:       { type: String, required: true, unique: true },
  merchant_id:     { type: String, required: true, index: true },
  amount:          { type: Number, required: true },
  currency:        { type: String, default: "AED" },
  bank_account: {
    account_name:   String,
    account_number: String,
    bank_name:      String,
    iban:           String,
    swift:          String
  },
  status: {
    type:    String,
    default: "PENDING",
    enum:    ["PENDING", "APPROVED", "COMPLETED", "REJECTED"]
  },
  note:            { type: String },  // merchant note
  admin_note:      { type: String },  // admin rejection reason
  requested_at:    { type: Date, default: Date.now },
  processed_at:    { type: Date }
});

export const PayoutRequestModel = mongoose.model("PayoutRequest", PayoutRequestSchema);
