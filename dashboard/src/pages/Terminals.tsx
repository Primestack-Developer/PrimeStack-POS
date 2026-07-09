import React, { useEffect, useState } from "react";
import { getMerchants, registerTerminal } from "../api/merchants";
import { Merchant } from "../types/merchant";

const P = "#0052FF";
const S = "#00C853";
const D = "#D50000";

export const Terminals: React.FC = () => {
  const [merchants, setMerchants]           = useState<Merchant[]>([]);
  const [loading, setLoading]               = useState(true);
  const [openForm, setOpenForm]             = useState<string | null>(null);
  const [terminalId, setTerminalId]         = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [newSecret, setNewSecret]           = useState<{ tid: string; secret: string } | null>(null);
  const [message, setMessage]               = useState<{ text: string; ok: boolean } | null>(null);

  const load = () => {
    setLoading(true);
    getMerchants().then(setMerchants).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async (merchantId: string, e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setNewSecret(null);
    try {
      const result = await registerTerminal({ merchant_id: merchantId, terminal_id: terminalId });
      setNewSecret({ tid: terminalId, secret: result.secret_key });
      setMessage({ text: "Terminal registered successfully!", ok: true });
      setTerminalId("");
      setOpenForm(null);
      load();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || "Registration failed",
        ok: false
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Terminal Management</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Register terminals for each merchant. After registration, use the Merchant ID + Terminal ID shown below in the Android app.
      </p>

      {/* New secret key banner — shown after registration */}
      {newSecret && (
        <div style={{
          background: "#e8f5e9", border: "1px solid #a5d6a7",
          padding: "16px 20px", borderRadius: 10, marginBottom: 20
        }}>
          <div style={{ fontWeight: 700, color: S, marginBottom: 8 }}>
            ✅ Terminal registered — save the secret key below (shown once only)
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 13, background: "#fff", padding: 12, borderRadius: 6 }}>
            <div><strong>Terminal ID:</strong> {newSecret.tid}</div>
            <div style={{ marginTop: 6, wordBreak: "break-all" }}>
              <strong>Secret Key:</strong> {newSecret.secret}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            The app retrieves this automatically when registering — you don't need to enter it manually.
          </div>
        </div>
      )}

      {message && !newSecret && (
        <div style={{
          background: message.ok ? "#e8f5e9" : "#ffebee",
          color: message.ok ? S : D,
          padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      {merchants.length === 0 ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 10, textAlign: "center", color: "#999" }}>
          No merchants yet. Register a merchant first from the Merchants page.
        </div>
      ) : (
        merchants.map(m => (
          <div key={m._id} style={{
            background: "#fff", padding: 24, borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20
          }}>
            {/* Merchant header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>{m.name}</h2>
                <span style={{ fontSize: 13, color: "#888" }}>Merchant ID: <strong style={{ color: P }}>{m.merchant_id}</strong></span>
              </div>
              <button
                onClick={() => { setOpenForm(openForm === m._id ? null : m._id); setMessage(null); setNewSecret(null); }}
                style={{
                  background: P, color: "#fff", border: "none",
                  padding: "8px 18px", borderRadius: 6,
                  fontWeight: 700, fontSize: 13, cursor: "pointer"
                }}
              >
                {openForm === m._id ? "Cancel" : "+ Add Terminal"}
              </button>
            </div>

            {/* App registration hint */}
            <div style={{
              padding: "10px 14px", background: "#e3f2fd",
              borderRadius: 8, fontSize: 13, color: "#1565c0", marginBottom: 14
            }}>
              📱 <strong>In the app:</strong> Merchant ID = <strong>{m.merchant_id}</strong>
            </div>

            {/* Registration form */}
            {openForm === m._id && (
              <form onSubmit={(e) => handleRegister(m.merchant_id, e)} style={{
                background: "#f8f9fa", padding: 16, borderRadius: 8,
                marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end"
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    Terminal ID
                  </label>
                  <input
                    required value={terminalId}
                    onChange={e => setTerminalId(e.target.value)}
                    placeholder="e.g. TERM-SHOP-001"
                    style={{
                      width: "100%", padding: "10px", border: "1px solid #ddd",
                      borderRadius: 6, fontSize: 14, boxSizing: "border-box" as const
                    }}
                  />
                </div>
                <button
                  type="submit" disabled={submitting}
                  style={{
                    background: submitting ? "#aaa" : S, color: "#fff",
                    border: "none", padding: "10px 20px",
                    borderRadius: 6, fontWeight: 700, fontSize: 13,
                    cursor: submitting ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap" as const
                  }}
                >
                  {submitting ? "Registering..." : "Register"}
                </button>
              </form>
            )}

            {/* Terminal list */}
            {m.terminals.length === 0 ? (
              <p style={{ color: "#999", margin: 0, fontSize: 14 }}>No terminals yet — click "+ Add Terminal"</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {m.terminals.map(t => (
                  <div key={t._id || t.terminal_id} style={{
                    padding: 14, border: "1px solid #eee", borderRadius: 8,
                    background: "#fafafa"
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.terminal_id}</div>
                    <div style={{
                      display: "inline-block",
                      background: t.status === "ACTIVE" ? "#e8f5e9" : "#ffebee",
                      color: t.status === "ACTIVE" ? S : D,
                      padding: "2px 8px", borderRadius: 4,
                      fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase" as const
                    }}>
                      {t.status}
                    </div>
                    {/* Show terminal ID to copy into app */}
                    <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                      📱 Use <strong>{t.terminal_id}</strong> in app Device ID field
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
