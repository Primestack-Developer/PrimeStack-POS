import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
// ExternalIssuer — registered external money servers
// Each entry represents one company/system that holds user
// balances and can be debited via the CASH_OUT flow.
// ─────────────────────────────────────────────────────────────

const ExternalIssuerSchema = new mongoose.Schema({
  server_id: { type: String, required: true, unique: true }, // "SRV-ABC123"
  name: { type: String, required: true },                    // "AcmePay Wallet"
  api_url: { type: String, required: true },                 // their debit endpoint
  api_key: { type: String, required: true },                 // secret for calling them
  status: { type: String, default: "ACTIVE" },               // ACTIVE | SUSPENDED
  currency: { type: String, default: "AED" },
  created_at: { type: Date, default: Date.now }
});

export const ExternalIssuerModel = mongoose.model("ExternalIssuer", ExternalIssuerSchema);

export interface ExternalIssuer {
  server_id: string;
  name: string;
  api_url: string;
  api_key: string;
  status: "ACTIVE" | "SUSPENDED";
  currency: string;
}
