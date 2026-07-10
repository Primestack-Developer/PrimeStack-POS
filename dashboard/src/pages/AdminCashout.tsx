import React, { useEffect, useState } from "react";
import { api } from "../api/client";

const P  = "#0052FF";
const S  = "#00C853";
const D  = "#D50000";
const G  = "#666";
const LG = "#f5f5f5";

type Step = "balance" | "initiate" | "verify" | "done";

interface WalletData {
  balance: number;
  currency: string;
  total_credited: number;
  total_debited: number;
  status: string;
}

export const AdminCashout: React.FC = () => {
  const [step, setStep]           = useState<Step>("balance");
  const [wallet, setWallet]       = useState<WalletData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [stnId, setStnId]         = useState("");
  const [stnCode, setStnCode]     = useState("");

  const [form, setForm] = useState({
    amount:         "",
    currency:       "USD",
    account_name:   "",
    account_number: "",
    bank_name:      "",
    iban:           "",
    swift:          "",
    country:        ""
  });

  // Load admin wallet balance
  useEffect(() => {
    api.get("/wallet/admin")
      .then(r => setWallet(r.data))
      .catch(() => {
        // Admin wallet may not exist yet — show zero
        setWallet({ balance: 0, currency: "USD", total_credited: 0, total_debited: 0, status: "ACTIVE" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setProcessing(true);
    try {
      const res = await api.post("/admin/cashout/initiate", {
        admin_id:    "admin",
        amount:      parseFloat(form.amount),
        currency:    form.currency,
        bank_account: {
          account_name:   form.account_name,
          account_number: form.account_number,
          bank_name:      form.bank_name,
          iban:           form.iban   || undefined,
          swift:          form.swift  || undefined,
          country:        form.country || undefined
        }
      });
      setStnId(res.data.stn_id);
      setStep("verify");
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to initiate cashout");
    } finally {
      setProcessing(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stnCode.length !== 6) {
      setError("Enter the 6-digit STN code");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const res = await api.post("/admin/cashout/verify", { stn_code: stnCode });
      if (res.data.success) {
        setSuccess(`Cashout ${res.data.status} — ${res.data.amount} ${res.data.currency}`);
        setStep("done");
        // Refresh wallet
        api.get("/wallet/admin").then(r => setWallet(r.data)).catch(() => {});
      } else {
        setError("Transfer failed — " + (res.data.transfer_response?.message || "Unknown error"));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Invalid or expired STN code");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep("balance");
    setError("");
    setSuccess("");
    setStnId("");
    setStnCode("");
    setForm({ amount: "", currency: "USD", account_name: "", account_number: "", bank_name: "", iban: "", swift: "", country: "" });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", border: "1px solid #ddd",
    borderRadius: 8, fontSize: 14, boxSizing: "border-box" as const
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "#333", marginBottom: 6
  };

  if (loading) return <p style={{ color: G, padding: 40 }}>Loading wallet…</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginTop: 0 }}>Admin Cashout</h1>
      <p style={{ color: G, marginBottom: 24, fontSize: 14 }}>
        Transfer funds from the admin treasury wallet to an external bank account.
        A 6-digit STN code is required to authorize the transfer.
      </p>

      {/* Wallet balance card */}
      {wallet && (
        <div style={{
          background: P, color: "#fff", borderRadius: 12,
          padding: "20px 24px", marginBottom: 28
        }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Admin Wallet Balance</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>
            {wallet.currency} {wallet.balance.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
            Total in: {wallet.currency} {wallet.total_credited.toFixed(2)} · 
            Total out: {wallet.currency} {wallet.total_debited.toFixed(2)}
          </div>
        </div>
      )}

      {/* Error / success */}
      {error && (
        <div style={{ background: "#ffebee", color: D, padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#e8f5e9", color: S, padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
          ✅ {success}
        </div>
      )}

      {/* Step 1: Initiate form */}
      {step === "balance" || step === "initiate" ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
          <h3 style={{ marginTop: 0 }}>Step 1 — Enter Transfer Details</h3>
          <form onSubmit={handleInitiate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Amount <span style={{ color: D }}>*</span></label>
                <input required type="number" min="1" step="0.01"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={inputStyle} placeholder="e.g. 8500.00" />
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  style={inputStyle}>
                  <option>USD</option><option>AED</option><option>EUR</option>
                  <option>GBP</option><option>USDT</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Account Holder Name <span style={{ color: D }}>*</span></label>
              <input required value={form.account_name}
                onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                style={inputStyle} placeholder="e.g. John Smith" />
            </div>
            <div>
              <label style={labelStyle}>Account Number <span style={{ color: D }}>*</span></label>
              <input required value={form.account_number}
                onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                style={inputStyle} placeholder="e.g. 1234567890" />
            </div>
            <div>
              <label style={labelStyle}>Bank Name <span style={{ color: D }}>*</span></label>
              <input required value={form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                style={inputStyle} placeholder="e.g. Wise, Emirates NBD" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>IBAN (optional)</label>
                <input value={form.iban}
                  onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                  style={inputStyle} placeholder="GB29NWBK..." />
              </div>
              <div>
                <label style={labelStyle}>SWIFT / BIC (optional)</label>
                <input value={form.swift}
                  onChange={e => setForm(f => ({ ...f, swift: e.target.value }))}
                  style={inputStyle} placeholder="TRWIBEB1XXX" />
              </div>
            </div>
            <button type="submit" disabled={processing}
              style={{
                background: processing ? "#aaa" : P,
                color: "#fff", border: "none",
                padding: "13px 0", borderRadius: 8,
                fontWeight: 700, fontSize: 15,
                cursor: processing ? "not-allowed" : "pointer"
              }}>
              {processing ? "Generating STN Code…" : "Generate STN Code →"}
            </button>
          </form>
        </div>
      ) : null}

      {/* Step 2: Enter STN code */}
      {step === "verify" && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
          <h3 style={{ marginTop: 0 }}>Step 2 — Enter 6-Digit STN Code</h3>
          <div style={{
            background: "#fff8e1", padding: "14px 16px",
            borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#e65100"
          }}>
            ⚠️ An STN code has been generated for this transfer.
            Check your authenticator app or email for the code.
            It expires in <strong>15 minutes</strong>.
            <br /><br />
            <strong>STN ID:</strong> <code style={{ fontSize: 12 }}>{stnId}</code>
          </div>
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>6-Digit STN Code <span style={{ color: D }}>*</span></label>
              <input
                required maxLength={6} minLength={6}
                value={stnCode}
                onChange={e => setStnCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  ...inputStyle,
                  fontSize: 32, fontWeight: 800,
                  textAlign: "center", letterSpacing: 16,
                  padding: "16px 14px"
                }}
                placeholder="000000"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={reset}
                style={{
                  flex: 1, background: LG, color: "#444", border: "none",
                  padding: "13px 0", borderRadius: 8,
                  fontWeight: 600, fontSize: 14, cursor: "pointer"
                }}>
                ← Cancel
              </button>
              <button type="submit" disabled={processing || stnCode.length !== 6}
                style={{
                  flex: 2,
                  background: processing || stnCode.length !== 6 ? "#aaa" : S,
                  color: "#fff", border: "none",
                  padding: "13px 0", borderRadius: 8,
                  fontWeight: 700, fontSize: 15,
                  cursor: processing || stnCode.length !== 6 ? "not-allowed" : "pointer"
                }}>
                {processing ? "Processing Transfer…" : "Confirm & Send Transfer ✓"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ margin: "0 0 8px" }}>Transfer Processed</h3>
          <p style={{ color: G, margin: "0 0 24px" }}>
            The transfer has been authorized and sent to the bank transfer provider.
          </p>
          <button onClick={reset}
            style={{
              background: P, color: "#fff", border: "none",
              padding: "12px 32px", borderRadius: 8,
              fontWeight: 700, fontSize: 14, cursor: "pointer"
            }}>
            New Cashout
          </button>
        </div>
      )}
    </div>
  );
};
