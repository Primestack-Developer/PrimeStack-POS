import React, { useEffect, useState } from "react";
import { getMerchants } from "../api/merchants";
import {
  getWallet,
  getWalletLedger,
  updateBankAccount,
  requestPayout,
  getMerchantPayouts
} from "../api/wallet";
import { Merchant } from "../types/merchant";
import { MerchantWallet as WalletData, LedgerEntry, PayoutRequest } from "../types/wallet";

const P  = "#0052FF";
const S  = "#00C853";
const D  = "#D50000";
const G  = "#666";
const LG = "#f5f5f5";

const fmt = (n: number, ccy = "AED") =>
  `${ccy} ${n.toFixed(2)}`;

const statusColor = (s: string) => {
  if (s === "APPROVED" || s === "COMPLETED" || s === "ACTIVE") return S;
  if (s === "REJECTED"  || s === "FROZEN"    || s === "SUSPENDED") return D;
  if (s === "PENDING")  return "#FF9800";
  return G;
};

const ledgerColor = (t: string) => {
  if (t === "CREDIT")   return S;
  if (t === "DEBIT")    return P;
  if (t === "REFUND")   return D;
  return G;
};

// ── Small reusable card ────────────────────────────────────────
const Card: React.FC<{ title: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  title, children, style = {}
}) => (
  <div style={{
    background: "#fff", borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    padding: "24px", marginBottom: "24px", ...style
  }}>
    <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", color: "#111" }}>{title}</h3>
    {children}
  </div>
);

// ── Field helper ──────────────────────────────────────────────
const Field: React.FC<{
  label: string; value: string; placeholder?: string;
  onChange: (v: string) => void; required?: boolean; type?: string;
}> = ({ label, value, placeholder, onChange, required, type = "text" }) => (
  <div>
    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#333" }}>
      {label}{required && <span style={{ color: D }}> *</span>}
    </label>
    <input
      type={type}
      required={required}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 14px", border: "1px solid #ddd",
        borderRadius: 7, fontSize: 14, boxSizing: "border-box" as const
      }}
    />
  </div>
);

// ── Badge ─────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    background: color, color: "#fff", padding: "3px 10px",
    borderRadius: 4, fontSize: 11, fontWeight: 700,
    textTransform: "uppercase" as const
  }}>
    {label}
  </span>
);

// ═════════════════════════════════════════════════════════════
export const MerchantWallet: React.FC = () => {
  const [merchants, setMerchants]     = useState<Merchant[]>([]);
  const [selected, setSelected]       = useState<string>("");
  const [wallet, setWallet]           = useState<WalletData | null>(null);
  const [ledger, setLedger]           = useState<LedgerEntry[]>([]);
  const [payouts, setPayouts]         = useState<PayoutRequest[]>([]);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);

  // Bank account form
  const [bankForm, setBankForm] = useState({
    account_name: "", account_number: "", bank_name: "",
    iban: "", swift: "", country: "AE"
  });
  const [savingBank, setSavingBank] = useState(false);

  // Payout form
  const [payoutForm, setPayoutForm] = useState({ amount: "", note: "" });
  const [requestingPayout, setRequestingPayout] = useState(false);

  // Load merchant list
  useEffect(() => {
    getMerchants().then((ms: Merchant[]) => {
      setMerchants(ms);
      if (ms.length > 0) setSelected(ms[0].merchant_id);
    }).catch(console.error);
  }, []);

  // Load wallet data when merchant selection changes
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setMsg(null);
    Promise.all([
      getWallet(selected),
      getWalletLedger(selected, 30),
      getMerchantPayouts(selected)
    ])
      .then(([w, l, p]) => {
        setWallet(w);
        setLedger(l);
        setPayouts(p);
        // Pre-fill bank form if data already saved
        if (w?.bank_account) {
          setBankForm({
            account_name:   w.bank_account.account_name   || "",
            account_number: w.bank_account.account_number || "",
            bank_name:      w.bank_account.bank_name      || "",
            iban:           w.bank_account.iban            || "",
            swift:          w.bank_account.swift           || "",
            country:        w.bank_account.country         || "AE"
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected]);

  const reload = () => {
    if (!selected) return;
    Promise.all([
      getWallet(selected),
      getWalletLedger(selected, 30),
      getMerchantPayouts(selected)
    ]).then(([w, l, p]) => {
      setWallet(w);
      setLedger(l);
      setPayouts(p);
    }).catch(console.error);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    setMsg(null);
    try {
      await updateBankAccount(selected, bankForm);
      setMsg({ text: "Bank account saved successfully.", ok: true });
      reload();
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message, ok: false });
    } finally {
      setSavingBank(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payoutForm.amount);
    if (!amount || amount <= 0) {
      setMsg({ text: "Enter a valid amount.", ok: false });
      return;
    }
    if (!bankForm.account_name || !bankForm.account_number || !bankForm.bank_name) {
      setMsg({ text: "Save your bank account details first.", ok: false });
      return;
    }
    setRequestingPayout(true);
    setMsg(null);
    try {
      const result = await requestPayout(selected, {
        amount,
        currency: wallet?.currency || "AED",
        bank_account: {
          account_name:   bankForm.account_name,
          account_number: bankForm.account_number,
          bank_name:      bankForm.bank_name,
          iban:           bankForm.iban   || undefined,
          swift:          bankForm.swift  || undefined
        },
        note: payoutForm.note || undefined
      });
      setMsg({ text: `Payout request submitted — ID: ${result.payout_id}`, ok: true });
      setPayoutForm({ amount: "", note: "" });
      reload();
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || err.message, ok: false });
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 24 }}>Merchant Wallet</h1>

      {/* Merchant selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, marginRight: 12 }}>Select Merchant:</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            padding: "8px 14px", borderRadius: 7, border: "1px solid #ddd",
            fontSize: 14, minWidth: 220
          }}
        >
          {merchants.map(m => (
            <option key={m.merchant_id} value={m.merchant_id}>
              {m.name} ({m.merchant_id})
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: G }}>Loading wallet…</p>}

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

      {wallet && (
        <>
          {/* ── Balance summary ──────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16, marginBottom: 24
          }}>
            {[
              { label: "Available Balance", value: fmt(wallet.balance, wallet.currency), color: P },
              { label: "Total Received",    value: fmt(wallet.total_credited, wallet.currency), color: S },
              { label: "Total Paid Out",    value: fmt(wallet.total_debited,  wallet.currency), color: D },
              { label: "Wallet Status",     value: wallet.status, color: statusColor(wallet.status) }
            ].map(stat => (
              <div key={stat.label} style={{
                background: "#fff", padding: "18px 20px",
                borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.07)"
              }}>
                <div style={{ fontSize: 12, color: G, marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* ── Bank account ───────────────────────────── */}
            <Card title="Bank Account for Payouts">
              <form onSubmit={handleSaveBank} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Account Name"   value={bankForm.account_name}   required placeholder="e.g. PrimeStack LLC"       onChange={v => setBankForm(f => ({ ...f, account_name:   v }))} />
                <Field label="Account Number" value={bankForm.account_number} required placeholder="e.g. 1234567890"           onChange={v => setBankForm(f => ({ ...f, account_number: v }))} />
                <Field label="Bank Name"      value={bankForm.bank_name}      required placeholder="e.g. Emirates NBD"         onChange={v => setBankForm(f => ({ ...f, bank_name:      v }))} />
                <Field label="IBAN"           value={bankForm.iban}                    placeholder="AE070331234567890123456"    onChange={v => setBankForm(f => ({ ...f, iban:           v }))} />
                <Field label="SWIFT / BIC"   value={bankForm.swift}                   placeholder="EBILAEAD"                  onChange={v => setBankForm(f => ({ ...f, swift:          v }))} />
                <Field label="Country Code"  value={bankForm.country}                 placeholder="AE"                         onChange={v => setBankForm(f => ({ ...f, country:        v }))} />
                <button
                  type="submit"
                  disabled={savingBank}
                  style={{
                    background: P, color: "#fff", border: "none",
                    padding: "11px 0", borderRadius: 7, fontWeight: 700,
                    fontSize: 14, cursor: savingBank ? "not-allowed" : "pointer",
                    opacity: savingBank ? 0.6 : 1
                  }}
                >
                  {savingBank ? "Saving…" : "Save Bank Account"}
                </button>
              </form>
            </Card>

            {/* ── Request payout ─────────────────────────── */}
            <Card title="Request Payout">
              <div style={{
                background: LG, borderRadius: 8, padding: "12px 16px",
                marginBottom: 16, fontSize: 13, color: "#444"
              }}>
                Available: <strong style={{ color: P, fontSize: 16 }}>
                  {fmt(wallet.balance, wallet.currency)}
                </strong>
              </div>
              <form onSubmit={handleRequestPayout} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field
                  label="Amount to withdraw" required type="number"
                  value={payoutForm.amount}
                  placeholder={`Max ${wallet.balance.toFixed(2)}`}
                  onChange={v => setPayoutForm(f => ({ ...f, amount: v }))}
                />
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#333" }}>
                    Note (optional)
                  </label>
                  <textarea
                    value={payoutForm.note}
                    onChange={e => setPayoutForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Any note for the payout team…"
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 14px", border: "1px solid #ddd",
                      borderRadius: 7, fontSize: 14, boxSizing: "border-box" as const,
                      resize: "vertical"
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={requestingPayout || wallet.balance <= 0}
                  style={{
                    background: wallet.balance > 0 ? S : "#ccc",
                    color: "#fff", border: "none",
                    padding: "11px 0", borderRadius: 7, fontWeight: 700,
                    fontSize: 14, cursor: requestingPayout || wallet.balance <= 0
                      ? "not-allowed" : "pointer",
                    opacity: requestingPayout ? 0.6 : 1
                  }}
                >
                  {requestingPayout ? "Submitting…" : "Submit Payout Request"}
                </button>
                <p style={{ fontSize: 12, color: G, margin: 0 }}>
                  Your request will be reviewed and the transfer will be processed manually. You will see the status update below.
                </p>
              </form>
            </Card>
          </div>

          {/* ── Payout history ─────────────────────────── */}
          <Card title="Payout Requests">
            {payouts.length === 0 ? (
              <p style={{ color: G, margin: 0 }}>No payout requests yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: LG }}>
                    {["Payout ID", "Amount", "Bank", "Status", "Note", "Requested"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, color: G, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(po => (
                    <tr key={po.payout_id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>{po.payout_id}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fmt(po.amount, po.currency)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>
                        {po.bank_account.bank_name}<br />
                        <span style={{ color: G, fontSize: 11 }}>{po.bank_account.account_number}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}><Badge label={po.status} color={statusColor(po.status)} /></td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: G }}>
                        {po.admin_note || po.note || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: G }}>
                        {new Date(po.requested_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── Ledger ─────────────────────────────────── */}
          <Card title="Transaction Ledger (last 30)">
            {ledger.length === 0 ? (
              <p style={{ color: G, margin: 0 }}>No transactions yet. Ledger updates automatically when payments are received.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: LG }}>
                    {["Type", "Amount", "Balance After", "Description", "Date"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, color: G, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry._id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <Badge label={entry.type} color={ledgerColor(entry.type)} />
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: ledgerColor(entry.type) }}>
                        {entry.type === "CREDIT" ? "+" : "−"}{fmt(entry.amount, entry.currency)}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
                        {fmt(entry.balance_after, entry.currency)}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: G, maxWidth: 280 }}>
                        {entry.description}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: G }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
