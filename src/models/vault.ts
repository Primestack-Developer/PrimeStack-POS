import mongoose from "mongoose";

const VaultSchema = new mongoose.Schema({
  token: String,
  encrypted_pan: String,
  expiry_month: String,
  expiry_year: String,
  created_at: { type: Date, default: Date.now }
});

export const VaultModel = mongoose.model("Vault", VaultSchema);
