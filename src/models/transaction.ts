import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  protocol: String,
  message_type: String,
  transaction_id: String,
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

  card: {
    entry_mode: String,
    token: String,
    emv_data: String,
    last4: String,
    pan: String,
    expiry_month: String,
    expiry_year: String,
    cvv_present: Boolean
  },

  transaction_flags: {
    offline: Boolean,
    moto: Boolean,
    recurring: Boolean
  },

  result: {
    status: String,
    code: String,
    description: String,
    auth_code: String,
    rrn: String,
    stan: String
  },

  flags: {
    offline_stored: Boolean,
    reversal_required: Boolean
  },

  security: {
    nonce: String,
    signature: String,
    algorithm: String
  },

  customer: {
    language: String,
    email: String,
    phone: String
  },

  metadata: {
    pos_app_version: String,
    os: String,
    note: String,
    receipt_code: String,         // Customer receipt reference
    stn_code: String,             // 6-digit Settlement Transaction Number — printed on receipt
    stn_used: Boolean,            // true after STN has been used for a payout
    stn_used_at: String,          // when it was used
    acquirer: String,
    acquirer_transaction_id: String,
    nmi_webhook: { type: mongoose.Schema.Types.Mixed },
    nmi_transaction_id: String
  },

  created_at: {
    type: Date,
    default: Date.now
  }
});

export const TransactionModel = mongoose.model("Transaction", TransactionSchema);
