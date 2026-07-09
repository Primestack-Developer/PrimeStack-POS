import React, { useEffect, useState } from "react";
import { getMerchants, registerMerchant } from "../api/merchants";
import { Merchant } from "../types/merchant";

const BRAND_PRIMARY = "#0052FF";
const BRAND_SUCCESS = "#00C853";
const BRAND_DANGER = "#D50000";

export const MerchantProfile: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({ merchant_id: "", business_name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await registerMerchant(formData);
      setMessage({ text: "Merchant registered successfully!", type: "success" });
      setFormData({ merchant_id: "", business_name: "", email: "" });
      setShowRegisterForm(false);
      loadMerchants();
    } catch (error) {
      setMessage({ text: "Error registering merchant. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>Merchant Profile</h1>
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          style={{
            background: BRAND_PRIMARY,
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {showRegisterForm ? "Cancel" : "Register New Merchant"}
        </button>
      </div>

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
        </div>
      )}

      {showRegisterForm && (
        <div style={{
          background: "#fff",
          padding: "30px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          marginBottom: "20px"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Register New Merchant</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Merchant ID</label>
              <input
                type="text"
                required
                value={formData.merchant_id}
                onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  fontSize: "14px"
                }}
                placeholder="e.g., MERCHANT_001"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Business Name</label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  fontSize: "14px"
                }}
                placeholder="e.g., Prime Store"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  fontSize: "14px"
                }}
                placeholder="e.g., merchant@primestack.com"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: BRAND_PRIMARY,
                color: "#fff",
                border: "none",
                padding: "12px 20px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? "Registering..." : "Register Merchant"}
            </button>
          </form>
        </div>
      )}

      {merchants.map(merchant => (
        <div key={merchant._id} style={{ background: "#fff", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "20px" }}>{merchant.name}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
            <div>
              <p><strong>Merchant ID:</strong> {merchant.merchant_id}</p>
              <p><strong>Country:</strong> {merchant.country}</p>
              <p><strong>Currency:</strong> {merchant.currency}</p>
            </div>
            <div>
              <p><strong>Created:</strong> {new Date(merchant.created_at).toLocaleString()}</p>
              <p><strong>Total Terminals:</strong> {merchant.terminals.length}</p>
              <p><strong>Active Terminals:</strong> {merchant.terminals.filter(t => t.status === "ACTIVE").length}</p>
            </div>
          </div>
        </div>
      ))}
      {merchants.length === 0 && !showRegisterForm && (
        <div style={{ background: "#fff", padding: "40px", borderRadius: "8px", textAlign: "center", color: "#999" }}>
          No merchants registered yet - click the button above to register!
        </div>
      )}
    </div>
  );
};
