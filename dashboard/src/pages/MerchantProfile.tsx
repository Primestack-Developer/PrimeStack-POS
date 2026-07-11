import React, { useEffect, useState } from "react";
import { getMerchants, registerMerchant, deleteMerchant } from "../api/merchants";
import { Merchant } from "../types/merchant";

const BRAND_PRIMARY = "#0052FF";
const BRAND_SUCCESS = "#00C853";
const BRAND_DANGER  = "#D50000";

export const MerchantProfile: React.FC = () => {
  const [merchants, setMerchants]       = useState<Merchant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [message, setMessage]           = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [form, setForm] = useState({
    merchant_id: "",
    name:        "",
    country:     "AE",
    currency:    "AED"
  });

  const load = () => {
    setLoading(true);
    getMerchants().then(setMerchants).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await registerMerchant(form);
      setMessage({ text: `Merchant "${form.name}" registered successfully!`, type: "success" });
      setForm({ merchant_id: "", name: "", country: "AE", currency: "AED" });
      setShowForm(false);
      load();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || "Registration failed — check fields",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px", borderRadius: "6px",
    border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box"
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Merchants</h1>
        <button
          onClick={() => { setShowForm(!showForm); setMessage(null); }}
          style={{
            background: BRAND_PRIMARY, color: "#fff", border: "none",
            padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer"
          }}
        >
          {showForm ? "Cancel" : "+ Register New Merchant"}
        </button>
      </div>

      {message && (
        <div style={{
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? BRAND_SUCCESS : BRAND_DANGER,
          padding: "14px 16px", borderRadius: "8px", marginBottom: 20, fontWeight: "bold"
        }}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", padding: 28, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Register New Merchant</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                Merchant ID <span style={{ color: BRAND_DANGER }}>*</span>
              </label>
              <input
                required value={form.merchant_id}
                onChange={e => setForm(f => ({ ...f, merchant_id: e.target.value }))}
                style={inputStyle} placeholder="e.g. MRC-10002"
              />
              <small style={{ color: "#888" }}>Used in the app registration screen</small>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                Business Name <span style={{ color: BRAND_DANGER }}>*</span>
              </label>
              <input
                required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle} placeholder="e.g. Prime Store Dubai"
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Country Code</label>
              <input
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                style={inputStyle} placeholder="AE"
                maxLength={2}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Currency</label>
              <input
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                style={inputStyle} placeholder="AED"
                maxLength={3}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button
                type="submit" disabled={submitting}
                style={{
                  background: submitting ? "#aaa" : BRAND_SUCCESS,
                  color: "#fff", border: "none", padding: "12px 28px",
                  borderRadius: 8, fontWeight: 700, fontSize: 14,
                  cursor: submitting ? "not-allowed" : "pointer"
                }}
              >
                {submitting ? "Registering..." : "Register Merchant"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Merchant list */}
      {merchants.length === 0 && !showForm ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 10, textAlign: "center", color: "#999" }}>
          No merchants yet. Click "Register New Merchant" to add one.
        </div>
      ) : (
        merchants.map(m => (
          <div key={m._id} style={{
            background: "#fff", padding: 24, borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0" }}>{m.name}</h2>
                <span style={{
                  background: "#e3f2fd", color: BRAND_PRIMARY,
                  padding: "2px 10px", borderRadius: 4, fontSize: 13, fontWeight: 600
                }}>
                  {m.merchant_id}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ textAlign: "right", fontSize: 13, color: "#888" }}>
                  <div>{m.country} · {m.currency}</div>
                  <div>{new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete merchant ${m.merchant_id}? This cannot be undone.`)) return;
                    try {
                      await deleteMerchant(m.merchant_id);
                      setMessage({ text: `Merchant "${m.name}" deleted successfully.`, type: "success" });
                      load();
                    } catch (err: any) {
                      setMessage({
                        text: err.response?.data?.message || "Failed to delete merchant",
                        type: "error"
                      });
                    }
                  }}
                  style={{
                    background: BRAND_DANGER, color: "#fff", border: "none",
                    padding: "6px 14px", borderRadius: 6, fontWeight: 700,
                    fontSize: 13, cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#f8f9fa", borderRadius: 8, fontSize: 13 }}>
              <strong>Terminals:</strong> {m.terminals.length} registered
              {" · "}<strong>Active:</strong> {m.terminals.filter(t => t.status === "ACTIVE").length}
            </div>
            {/* Show Merchant ID clearly for app registration */}
            <div style={{
              marginTop: 10, padding: "10px 14px",
              background: "#fff8e1", borderRadius: 8, fontSize: 13, color: "#e65100"
            }}>
              📱 Use <strong>{m.merchant_id}</strong> in the Android app registration screen
            </div>
          </div>
        ))
      )}
    </div>
  );
};
