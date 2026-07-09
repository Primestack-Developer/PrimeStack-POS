import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { Link } from "react-router-dom";

interface Stats {
  totalTransactions: number;
  approvedCount: number;
  declinedCount: number;
  totalVolume: number;
  cashOutCount: number;
  cashOutVolume: number;
  activeTerminals: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    approvedCount: 0,
    declinedCount: 0,
    totalVolume: 0,
    cashOutCount: 0,
    cashOutVolume: 0,
    activeTerminals: 0
  });
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/transactions"),
      api.get("/merchants"),
      api.get("/cashout/all").catch(() => ({ data: [] }))
    ])
      .then(([txRes, merchantRes, cashoutRes]) => {
        const txs: any[]       = txRes.data || [];
        const merchants: any[] = merchantRes.data || [];
        const cashouts: any[]  = cashoutRes.data || [];

        const approved = txs.filter(t => t.result?.status?.toUpperCase() === "APPROVED");
        const declined = txs.filter(t => t.result?.status?.toUpperCase() === "DECLINED");
        const volume   = approved.reduce((sum, t) => sum + (t.amount?.value || 0), 0);

        const activeTerminals = merchants.reduce(
          (sum: number, m: any) =>
            sum + (m.terminals || []).filter((t: any) => t.status === "ACTIVE").length,
          0
        );

        const cashOutApproved = cashouts.filter(
          (c: any) => c.result?.status?.toUpperCase() === "APPROVED"
        );
        const cashOutVolume = cashOutApproved.reduce(
          (sum: number, c: any) => sum + (c.amount?.value || 0),
          0
        );

        setStats({
          totalTransactions: txs.length,
          approvedCount: approved.length,
          declinedCount: declined.length,
          totalVolume: volume,
          cashOutCount: cashouts.length,
          cashOutVolume,
          activeTerminals
        });

        setRecentTx(txs.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCard = (
    label: string,
    value: string,
    color: string,
    sub?: string
  ) => (
    <div style={{
      background: "#fff",
      padding: "20px",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666", fontWeight: 500 }}>
        {label}
      </h3>
      <p style={{ fontSize: "32px", fontWeight: "bold", color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: "12px", color: "#999", margin: "4px 0 0 0" }}>{sub}</p>}
    </div>
  );

  const statusBadge = (status: string) => {
    const color = status === "APPROVED" ? "#4CAF50" : status === "DECLINED" ? "#f44336" : "#FF9800";
    return (
      <span style={{
        background: color,
        color: "#fff",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "bold",
        textTransform: "uppercase" as const
      }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: "24px" }}>Dashboard</h1>

      {loading ? (
        <p style={{ color: "#666" }}>Loading stats...</p>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "32px"
          }}>
            {statCard("Total Transactions", String(stats.totalTransactions), "#00d9ff")}
            {statCard(
              "Total Volume",
              `AED ${stats.totalVolume.toFixed(2)}`,
              "#4CAF50",
              `${stats.approvedCount} approved`
            )}
            {statCard(
              "Declined",
              String(stats.declinedCount),
              "#f44336",
              stats.totalTransactions > 0
                ? `${((stats.declinedCount / stats.totalTransactions) * 100).toFixed(1)}% decline rate`
                : undefined
            )}
            {statCard("Active Terminals", String(stats.activeTerminals), "#FF9800")}
            {statCard(
              "Cash-Outs",
              String(stats.cashOutCount),
              "#9C27B0",
              `AED ${stats.cashOutVolume.toFixed(2)} volume`
            )}
          </div>

          {/* Recent transactions */}
          <div style={{
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0 }}>Recent Transactions</h3>
              <Link to="/transactions" style={{ color: "#00d9ff", textDecoration: "none", fontSize: "14px" }}>
                View all →
              </Link>
            </div>
            {recentTx.length === 0 ? (
              <p style={{ padding: "40px", textAlign: "center", color: "#999", margin: 0 }}>
                No transactions yet
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "13px" }}>ID</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "13px" }}>Amount</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "13px" }}>Status</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "13px" }}>Terminal</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "13px" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map(tx => (
                    <tr key={tx._id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <Link to={`/transactions/${tx._id}`} style={{ color: "#00d9ff", textDecoration: "none", fontSize: "13px" }}>
                          {tx.transaction_id}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: "bold", fontSize: "13px" }}>
                        {tx.amount?.value?.toFixed(2)} {tx.amount?.currency}
                      </td>
                      <td style={{ padding: "10px 16px" }}>{statusBadge(tx.result?.status || "")}</td>
                      <td style={{ padding: "10px 16px", fontSize: "13px", color: "#666" }}>
                        {tx.merchant?.terminal_id}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: "13px", color: "#666" }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
