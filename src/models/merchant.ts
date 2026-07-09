import mongoose from "mongoose";

const TerminalSchema = new mongoose.Schema({
  terminal_id: String,
  secret_key: String,
  status: String
});

const MerchantSchema = new mongoose.Schema({
  merchant_id: String,
  name: String,
  country: String,
  currency: String,
  terminals: [TerminalSchema],
  created_at: {
    type: Date,
    default: Date.now
  }
});

export const MerchantModel = mongoose.model("Merchant", MerchantSchema);

export interface Merchant {
  merchant_id: string;
  name: string;
  country: string;
  currency: string;
  terminals: Terminal[];
}

export interface Terminal {
  terminal_id: string;
  secret_key: string;
  status: "ACTIVE" | "DISABLED";
}
