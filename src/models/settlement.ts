import mongoose from "mongoose";

const SettlementSchema = new mongoose.Schema({
  batch_id: String,
  merchant_id: String,
  terminal_id: String,
  date: String,
  period: { type: String, enum: ["daily", "weekly", "monthly"] },

  totals: {
    approved_count: Number,
    approved_amount: Number,
    declined_count: Number,
    declined_amount: Number,
    total_count: Number,
    total_amount: Number
  },

  transactions: [String], // list of transaction IDs

  created_at: {
    type: Date,
    default: Date.now
  }
});

export const SettlementModel = mongoose.model("Settlement", SettlementSchema);
