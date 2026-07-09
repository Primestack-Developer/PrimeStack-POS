import React, { useEffect, useState } from "react";
import { getTransactions } from "../api/transactions";
import { Transaction } from "../types/transaction";
import { Link } from "react-router-dom";

export const Transactions: React.FC = () => {
  const [list, setList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransactions()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "#4CAF50";
      case "declined": return "#f44336";
      case "pending": return "#FF9800";
      default: return "#666";
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Transactions</h1>
      <div style={{ background: "#fff", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: "15px", textAlign: "left" }}>ID</th>
              <th style={{ padding: "15px", textAlign: "left" }}>Amount</th>
              <th style={{ padding: "15px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "15px", textAlign: "left" }}>Terminal</th>
              <th style={{ padding: "15px", textAlign: "left" }}>Entry Mode</th>
              <th style={{ padding: "15px", textAlign: "left" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No transactions yet
                </td>
              </tr>
            ) : (
              list.map(tx => (
                <tr key={tx._id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "15px" }}>
                    <Link 
                      to={`/transactions/${tx._id}`}
                      style={{ color: "#00d9ff", textDecoration: "none" }}
                    >
                      {tx.transaction_id}
                    </Link>
                  </td>
                  <td style={{ padding: "15px", fontWeight: "bold" }}>
                    {tx.amount.value.toFixed(2)} {tx.amount.currency}
                  </td>
                  <td style={{ padding: "15px" }}>
                    <span style={{ 
                      background: getStatusColor(tx.result.status), 
                      color: "#fff", 
                      padding: "5px 10px", 
                      borderRadius: "4px",
                      fontSize: "12px",
                      textTransform: "uppercase"
                    }}>
                      {tx.result.status}
                    </span>
                  </td>
                  <td style={{ padding: "15px" }}>{tx.merchant.terminal_id}</td>
                  <td style={{ padding: "15px" }}>{tx.card.entry_mode}</td>
                  <td style={{ padding: "15px" }}>
                    {new Date(tx.timestamp).toLocaleString()}
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
