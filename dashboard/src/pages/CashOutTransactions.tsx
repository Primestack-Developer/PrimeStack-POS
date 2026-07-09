import React, { useEffect, useState } from "react";
import { api } from "../api/client";

interface CashOut {
  _id: string;
  transaction_id: string;
  timestamp: string;
  amount: { value: number; currency: string };
  external_issuer: {
    server_id: string;
    user_id: string;
    issuer_reference?: string;
    balance_after?: number;
  };
  result: {
    status: string;
    code: string;
    description: string;
    auth_code?: string;
    rrn?: string;
  };
  merchant: {
    merchant_id: string;
    terminal_id: string;
  };
}

export const CashOutTransactions: React.FC = () => {
  const [list, setList] = useState<CashOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all cash-outs (no merchant filter — admin view)
    api
      .get("/cashout/all")
      .then(res => setList(res.data || []))
      .catch(err => setError(err.message || "Failed to load cash-outs"))
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED": return "#4CAF50";
      case "DECLINED": return "#f44336";
      default:         return "#FF9800";
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error)   return <div style={{ color: "#f44336" }}>Error: {error}</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Cash-Out Transactions</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        These are external-issuer withdrawals — money debited from customer servers and dispensed as cash at this POS.
      </p>

      <div style={{
        background: "#fff",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Transaction ID</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Amount</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Server ID</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>User ID</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Issuer Ref</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Terminal</th>
              <th style={{ padding: "14px 16px", textAlign: "left" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No cash-out transactions yet
                </td>
              </tr>
            ) : (
              list.map(co => (
                <tr key={co._id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px" }}>
                    {co.transaction_id}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: "bold" }}>
                    {co.amount.value.toFixed(2)} {co.amount.currency}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: statusColor(co.result.status),
                      color: "#fff",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      textTransform: "uppercase"
                    }}>
                      {co.result.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px" }}>{co.external_issuer.server_id}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px" }}>{co.external_issuer.user_id}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "#666" }}>
                    {co.external_issuer.issuer_reference || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "#666" }}>
                    {co.merchant.terminal_id}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "#666" }}>
                    {new Date(co.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
