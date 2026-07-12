import React, { useEffect, useState } from "react";
import { api } from "../api/client";

const P  = "#0052FF";
const S  = "#00C853";
const D  = "#D50000";
const O  = "#FF9800";
const G  = "#666";
const LG = "#f5f5f5";

type QueueStatus = "PENDING" | "SYNCED" | "FAILED";

interface QueueRecord {
  _id: string;
  transaction_id: string;
  endpoint: string;
  status: QueueStatus;
  attempts: number;
  last_error?: string;
  created_at: string;
  synced_at?: string;
  payload: {
    message_type: string;
    amount?: { value: number; currency: string };
    merchant?: { merchant_id: string; terminal_id: string };
    card?: { entry_mode: string; last4?: string };
    timestamp: string;
  };
}

const statusColor = (s: QueueStatus) => {
  if (s === "SYNCED")  return S;
  if (s === "FAILED")  return D;
  if (s === "PENDING") return O;
  return G;
};

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    background: color, color: "#fff", padding: "3px 10px",
    borderRadius: 4, fontSize: 11, fontWeight: 700,
    textTransform: "uppercase" as const
  }}>
    {label}
  </span>
);

export const OfflineQueue: React.FC = () => {
  const [records, setRecords]   = useState<QueueRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [filter, setFilter]     = useState<string>("PENDING");
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const load = (status?: string) => {
    setLoading(true);
    Promise.all([
      api.get("/offline/queue", { params: status ? { status } : {} }),
      api.get("/offline/status")
    ])
      .then(([qRes, sRes]) => {
        setRecords(qRes.data || []);
        setPendingCount(sRes.data?.pending || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await api.post("/offline/sync");
      const { synced, failed, total } = res.data;
      setMsg({
        text: `Sync complete — ${synced} synced, ${failed} failed out of ${total} records`,
        ok:   failed === 0
      });
      load(filter);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message || "Sync failed", ok: false });
    } finally {
      setSyncing(false);
    }
  };

  const counts = {
    PENDING: records.filter(r => r.status === "PENDING").length,
    SYNCED:  records.filter(r => r.status === "SYNCED").length,
    FAILED:  records.filter(r => r.status === "FAILED").length
  };

  return (
    <div>
      {/* Header + Sync button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0" }}>Offline Transactions</h1>
          <p style={{ color: G, margin: 0, fontSize: 14 }}>
            Transactions stored on POS devices when there was no internet connection.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || pendingCount === 0}
          style={{
            background: syncing || pendingCount === 0 ? "#aaa" : S,
            color: "#fff", border: "none",
            padding: "14px 28px", borderRadius: 10,
            fontWeight: 700, fontSize: 16,
            cursor: syncing || pendingCount === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: pendingCount > 0 ? "0 4px 12px rgba(0,200,83,0.4)" : "none"
          }}
        >
          {syncing ? "⏳ Syncing…" : `🔄 Sync Now (${pendingCount} pending)`}
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Pending",  count: pendingCount, color: O },
          { label: "Synced",   count: counts.SYNCED, color: S },
          { label: "Failed",   count: counts.FAILED,  color: D }
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", padding: "18px 20px",
            borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            borderLeft: `4px solid ${s.color}`
          }}>
            <div style={{ fontSize: 12, color: G, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          background: msg.ok ? "#e8f5e9" : "#ffebee",
          color: msg.ok ? S : D,
          padding: "12px 16px", borderRadius: 8,
          marginBottom: 20, fontWeight: 600
        }}>
          {msg.text}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["PENDING", "SYNCED", "FAILED", ""] as const).map(s => (
          <button
            key={s || "ALL"}
            onClick={() => setFilter(s)}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              cursor: "pointer", fontWeight: 600, fontSize: 13,
              background: filter === s ? P : LG,
              color: filter === s ? "#fff" : "#444"
            }}
          >
            {s || "ALL"}
          </button>
        ))}
      </div>

      {/* Records table */}
      {loading ? (
        <p style={{ color: G }}>Loading…</p>
      ) : records.length === 0 ? (
        <div style={{
          background: "#fff", padding: 40, borderRadius: 10,
          textAlign: "center", color: G,
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)"
        }}>
          {filter === "PENDING" ? "No pending offline transactions. All synced! ✅" : "No records for this filter."}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: LG }}>
                {["Transaction ID", "Type", "Amount", "Terminal", "Entry Mode", "Status", "Attempts", "Created"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: G, fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r._id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: G }}>
                    {r.transaction_id}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13 }}>
                    {r.payload?.message_type || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                    {r.payload?.amount
                      ? `${r.payload.amount.currency} ${r.payload.amount.value?.toFixed(2)}`
                      : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>
                    {r.payload?.merchant?.terminal_id || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>
                    {r.payload?.card?.entry_mode || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={r.status} color={statusColor(r.status)} />
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: G }}>
                    {r.attempts}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: G }}>
                    {new Date(r.created_at).toLocaleString()}
                    {r.last_error && (
                      <div style={{ color: D, fontSize: 11, marginTop: 2 }}>{r.last_error}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
