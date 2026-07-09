import React, { useEffect, useState } from "react";
import {
  getAllPayouts,
  approvePayout,
  completePayout,
  rejectPayout
} from "../api/wallet";
import { PayoutRequest, PayoutStatus } from "../types/wallet";

const P  = "#0052FF";
const S  = "#00C853";
const D  = "#D50000";
const G  = "#666";
const LG = "#f5f5f5";

const statusColor = (s: PayoutStatus) => {
  if (s === "COMPLETED" || s === "APPROVED") return S;
  if (s === "REJECTED") return D;
  if (s === "PENDING")  return "#FF9800";
  return G;
};

const fmt = (n: number, c = "AED") => `${c} ${n.toFixed(2)}`;

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    background: color, color: "#fff", padding: "3px 10px",
    borderRadius: 4, fontSize: 11, fontWeight: 700,
    textTransform: "uppercase" as const
  }}>
    {label}
  </span>
);

export const AdminPayouts: React.FC = () => {
  const [payouts, setPayouts]         = useState<PayoutRequest[]>([]);
  const [filter, setFilter]           = useState<string>("PENDING");
  const [loading, setLoading]         = useState(true);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState<{ [id: string]: string }>({});
  const [adminNote, setAdminNote]     = useState<{ [id: string]: string }>({});

  const load = (status?: string) => {
    setLoading(true);
    getAllPayouts(status || undefined)
      .then(setPayouts)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleApprove = async (po: PayoutRequest) => {
    setActionId(po.payout_id);
    setMsg(null);
    try {
      const res = await approvePayout(po.payout_id, adminNote[po.payout_id]);
      setMsg({
        text: `Approved — balance after: ${fmt(res.balance_after, po.currency)}. Now initiate the bank transfer manually.`,
        ok: true
      });
      load(filter);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message, ok: false });
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (po: PayoutRequest) => {
    setActionId(po.payout_id);
    setMsg(null);
    try {
      await completePayout(po.payout_id);
      setMsg({ text: `Payout ${po.payout_id} marked as COMPLETED.`, ok: true });
      load(filter);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message, ok: false });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (po: PayoutRequest) => {
    const note = rejectNote[po.payout_id];
    if (!note?.trim()) {
      setMsg({ text: "Please enter a reason before rejecting.", ok: false });
      return;
    }
    setActionId(po.payout_id);
    setMsg(null);
    try {
      await rejectPayout(po.payout_id, note);
      setMsg({ text: `Payout ${po.payout_id} rejected.`, ok: true });
      load(filter);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message, ok: false });
    } finally {
      setActionId(null);
    }
  };

  // Summary counts
  const counts = {
    PENDING:   payouts.filter(p => p.status === "PENDING").length,
    APPROVED:  payouts.filter(p => p.status === "APPROVED").length,
    COMPLETED: payouts.filter(p => p.status === "COMPLETED").length,
    REJECTED:  payouts.filter(p => p.status === "REJECTED").length
  };

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Payout Management</h1>
      <p style={{ color: G, marginBottom: 24, fontSize: 14 }}>
        Review and approve merchant withdrawal requests. Approve → initiate bank transfer manually → mark Complete.
      </p>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["PENDING", "APPROVED", "COMPLETED", "REJECTED", ""] as const).map(s => (
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
            {s === "PENDING" && counts.PENDING > 0 && (
              <span style={{
                background: "#FF9800", color: "#fff",
                borderRadius: "50%", padding: "1px 6px",
                fontSize: 11, marginLeft: 6
              }}>
                {counts.PENDING}
              </span>
            )}
          </button>
        ))}
      </div>

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

      {loading ? (
        <p style={{ color: G }}>Loading…</p>
      ) : payouts.length === 0 ? (
        <div style={{
          background: "#fff", padding: 40, borderRadius: 10,
          textAlign: "center", color: G,
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)"
        }}>
          No payout requests for this filter.
        </div>
      ) : (
        payouts.map(po => (
          <div key={po.payout_id} style={{
            background: "#fff", borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            padding: 24, marginBottom: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Left: details */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: G }}>{po.payout_id}</span>
                  <Badge label={po.status} color={statusColor(po.status)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "6px 32px", fontSize: 14 }}>
                  <span style={{ color: G, fontSize: 12 }}>Merchant</span>
                  <span style={{ color: G, fontSize: 12 }}>Amount</span>
                  <span style={{ color: G, fontSize: 12 }}>Bank</span>
                  <span style={{ color: G, fontSize: 12 }}>Requested</span>

                  <strong>{po.merchant_id}</strong>
                  <strong style={{ color: P, fontSize: 16 }}>{fmt(po.amount, po.currency)}</strong>
                  <div>
                    <div style={{ fontWeight: 600 }}>{po.bank_account.bank_name}</div>
                    <div style={{ fontSize: 12, color: G }}>{po.bank_account.account_name}</div>
                    <div style={{ fontSize: 12, color: G }}>{po.bank_account.account_number}</div>
                    {po.bank_account.iban && (
                      <div style={{ fontSize: 11, color: G }}>IBAN: {po.bank_account.iban}</div>
                    )}
                    {po.bank_account.swift && (
                      <div style={{ fontSize: 11, color: G }}>SWIFT: {po.bank_account.swift}</div>
                    )}
                  </div>
                  <div>
                    {new Date(po.requested_at).toLocaleString()}
                    {po.processed_at && (
                      <div style={{ fontSize: 11, color: G }}>
                        Processed: {new Date(po.processed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {po.note && (
                  <div style={{ marginTop: 10, fontSize: 13, color: G }}>
                    Merchant note: <em>{po.note}</em>
                  </div>
                )}
                {po.admin_note && (
                  <div style={{ marginTop: 6, fontSize: 13, color: po.status === "REJECTED" ? D : G }}>
                    Admin note: <em>{po.admin_note}</em>
                  </div>
                )}
              </div>

              {/* Right: actions */}
              <div style={{ marginLeft: 24, minWidth: 200 }}>
                {po.status === "PENDING" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Admin note (optional)"
                      value={adminNote[po.payout_id] || ""}
                      onChange={e => setAdminNote(n => ({ ...n, [po.payout_id]: e.target.value }))}
                      style={{
                        padding: "8px 10px", border: "1px solid #ddd",
                        borderRadius: 6, fontSize: 13
                      }}
                    />
                    <button
                      onClick={() => handleApprove(po)}
                      disabled={actionId === po.payout_id}
                      style={{
                        background: S, color: "#fff", border: "none",
                        padding: "10px 0", borderRadius: 6,
                        fontWeight: 700, fontSize: 13, cursor: "pointer"
                      }}
                    >
                      ✓ Approve & Debit Wallet
                    </button>
                    <textarea
                      placeholder="Rejection reason (required to reject)"
                      value={rejectNote[po.payout_id] || ""}
                      onChange={e => setRejectNote(n => ({ ...n, [po.payout_id]: e.target.value }))}
                      rows={2}
                      style={{
                        padding: "8px 10px", border: "1px solid #ddd",
                        borderRadius: 6, fontSize: 13, resize: "vertical" as const
                      }}
                    />
                    <button
                      onClick={() => handleReject(po)}
                      disabled={actionId === po.payout_id}
                      style={{
                        background: D, color: "#fff", border: "none",
                        padding: "10px 0", borderRadius: 6,
                        fontWeight: 700, fontSize: 13, cursor: "pointer"
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}

                {po.status === "APPROVED" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      background: "#fff3e0", padding: "10px 12px",
                      borderRadius: 6, fontSize: 13, color: "#e65100"
                    }}>
                      ⚠ Bank transfer pending — send {fmt(po.amount, po.currency)} to the account on the left, then mark complete.
                    </div>
                    <button
                      onClick={() => handleComplete(po)}
                      disabled={actionId === po.payout_id}
                      style={{
                        background: P, color: "#fff", border: "none",
                        padding: "10px 0", borderRadius: 6,
                        fontWeight: 700, fontSize: 13, cursor: "pointer"
                      }}
                    >
                      ✓ Mark Transfer Complete
                    </button>
                  </div>
                )}

                {(po.status === "COMPLETED" || po.status === "REJECTED") && (
                  <div style={{ fontSize: 13, color: G, textAlign: "center", paddingTop: 8 }}>
                    No further action needed.
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
