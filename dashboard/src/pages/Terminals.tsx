import React, { useEffect, useState } from "react";
import { getMerchants, registerTerminal } from "../api/merchants";
import { Merchant, Terminal } from "../types/merchant";

const BRAND_PRIMARY = "#0052FF";
const BRAND_SUCCESS = "#00C853";
const BRAND_DANGER = "#D50000";

export const Terminals: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ terminal_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [newTerminalSecret, setNewTerminalSecret] = useState<string | null>(null);

  const loadMerchants = () => {
    setLoading(true);
    getMerchants()
      .then(setMerchants)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMerchants();
  }, []);

  const getStatusColor = (status: string) => {
    return status.toLowerCase() === "active" ? "#4CAF50" : "#f44336";
  };

  const handleSubmit = async (merchantId: string, e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setNewTerminalSecret(null);

    try {
      const result = await registerTerminal({
        merchant_id: merchantId,
        terminal_id: formData.terminal_id
      });
      setMessage({ text: "Terminal registered successfully!", type: "success" });
      setNewTerminalSecret(result.secret_key);
      setFormData({ terminal_id: "" });
      setShowRegisterForm(null);
      loadMerchants();
    } catch (error) {
      setMessage({ text: "Error registering terminal. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: "20px" }}>Terminals</h1>

      {message && (
        <div style={{
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? BRAND_SUCCESS : BRAND_DANGER,
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontWeight: "bold"
        }}>
          {message.text}
          {newTerminalSecret && (
            <div style={{
              marginTop: "10px",
              background: "#fff",
              padding: "15px",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "13px",
              wordBreak: "break-all"
            }}>
              <strong style={{ display: "block", marginBottom: "5px", color: BRAND_PRIMARY }}>IMPORTANT: Save this Secret Key! It will not be shown again!</strong>
              <div style={{ color: "#333" }}>
                Secret Key: {newTerminalSecret}
              </div>
            </div>
          )}
        </div>
      )}

      {merchants.map(merchant => (
        <div key={merchant._id} style={{ background: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>{merchant.name}</h2>
            <button
              onClick={() => setShowRegisterForm(showRegisterForm === merchant._id ? null : merchant._id)}
              style={{
                background: BRAND_PRIMARY,
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {showRegisterForm === merchant._id ? "Cancel" : "Register Terminal"}
            </button>
          </div>

          {showRegisterForm === merchant._id && (
            <div style={{
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "15px"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Register New Terminal for {merchant.name}</h3>
              <form onSubmit={(e) => handleSubmit(merchant.merchant_id, e)} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>Terminal ID</label>
                  <input
                    type="text"
                    required
                    value={formData.terminal_id}
                    onChange={(e) => setFormData({ ...formData, terminal_id: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      fontSize: "14px"
                    }}
                    placeholder="e.g., TERMINAL_001"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: BRAND_PRIMARY,
                    color: "#fff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    whiteSpace: "nowrap"
                  }}
                >
                  {submitting ? "Registering..." : "Register"}
                </button>
              </form>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
            {merchant.terminals.length === 0 ? (
              <p style={{ color: "#999", gridColumn: "1 / -1" }}>No terminals registered</p>
            ) : (
              merchant.terminals.map(terminal => (
                <div key={terminal._id || terminal.terminal_id} style={{ padding: "15px", border: "1px solid #eee", borderRadius: "8px" }}>
                  <h3 style={{ marginTop: 0 }}>{terminal.terminal_id}</h3>
                  <p><strong>Status:</strong> <span style={{
                    color: getStatusColor(terminal.status),
                    fontWeight: "bold",
                    textTransform: "uppercase"
                  }}>{terminal.status}</span></p>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
      {merchants.length === 0 && (
        <div style={{ background: "#fff", padding: "40px", borderRadius: "8px", textAlign: "center", color: "#999" }}>
          No merchants registered yet - go to Merchant Profile to register one!
        </div>
      )}
    </div>
  );
};
