import React, { useEffect, useState } from "react";
import { getTransaction } from "../api/transactions";
import { Transaction } from "../types/transaction";
import { useParams, Link } from "react-router-dom";

export const TransactionDetails: React.FC = () => {
  const { id } = useParams();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getTransaction(id)
        .then(setTx)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "#4CAF50";
      case "declined": return "#f44336";
      case "pending": return "#FF9800";
      default: return "#666";
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!tx) return <div>Transaction not found</div>;

  return (
    <div>
      <Link to="/transactions" style={{ color: "#00d9ff", textDecoration: "none", marginBottom: "20px", display: "inline-block" }}>
        ← Back to Transactions
      </Link>
      
      <div style={{ background: "#fff", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <h1 style={{ marginTop: 0, marginBottom: "20px" }}>Transaction {tx.transaction_id}</h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
          <div>
            <h3>Transaction Details</h3>
            <p><strong>Status:</strong> <span style={{ 
              background: getStatusColor(tx.result.status), 
              color: "#fff", 
              padding: "5px 10px", 
              borderRadius: "4px",
              fontSize: "12px",
              textTransform: "uppercase"
            }}>{tx.result.status}</span></p>
            <p><strong>Amount:</strong> {tx.amount.value.toFixed(2)} {tx.amount.currency}</p>
            <p><strong>Timestamp:</strong> {new Date(tx.timestamp).toLocaleString()}</p>
          </div>
          
          <div>
            <h3>Merchant Details</h3>
            <p><strong>Merchant ID:</strong> {tx.merchant.merchant_id}</p>
            <p><strong>Store ID:</strong> {tx.merchant.store_id}</p>
            <p><strong>Terminal ID:</strong> {tx.merchant.terminal_id}</p>
          </div>
          
          <div>
            <h3>Card Details</h3>
            <p><strong>Entry Mode:</strong> {tx.card.entry_mode}</p>
            {tx.card.last4 && <p><strong>Last 4 Digits:</strong> **** **** **** {tx.card.last4}</p>}
            {tx.card.token && <p><strong>Token:</strong> {tx.card.token}</p>}
          </div>
          
          <div>
            <h3>Result Codes</h3>
            {tx.result.auth_code && <p><strong>Auth Code:</strong> {tx.result.auth_code}</p>}
            {tx.result.rrn && <p><strong>RRN:</strong> {tx.result.rrn}</p>}
            {tx.result.stan && <p><strong>STAN:</strong> {tx.result.stan}</p>}
            <p><strong>Response Code:</strong> {tx.result.code}</p>
            <p><strong>Description:</strong> {tx.result.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
