import mongoose from "mongoose";

const ChargebackSchema = new mongoose.Schema({
  case_id: String,
  transaction_id: String,
  merchant_id: String,
  reason_code: String,
  description: String,
  status: String, // OPEN, WON, LOST
  created_at: { type: Date, default: Date.now }
});

export const ChargebackModel = mongoose.model("Chargeback", ChargebackSchema);
