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
    note: String
  },

  created_at: {
    type: Date,
    default: Date.now
  }
});

export const TransactionModel = mongoose.model("Transaction", TransactionSchema);
