import mongoose from "mongoose";

const ReconciliationSchema = new mongoose.Schema({
  batch_id: String,
  merchant_id: String,

  matched: Number,
  mismatched: Number,
  missing: Number,

  details: [
    {
      transaction_id: String,
      rrn: String,
      stan: String,
      status: String,
      acquirer_status: String,
      match: Boolean,
      amount_match: Boolean,
      notes: String
    }
  ],

  created_at: {
    type: Date,
    default: Date.now
  }
});

export const ReconciliationModel = mongoose.model("Reconciliation", ReconciliationSchema);
