import { api } from "./client";

// ── Wallet ────────────────────────────────────────────────────
export async function getWallet(merchantId: string) {
  const res = await api.get(`/wallet/${merchantId}`);
  return res.data;
}

export async function getWalletLedger(merchantId: string, limit = 50) {
  const res = await api.get(`/wallet/${merchantId}/ledger`, {
    params: { limit }
  });
  return res.data;
}

export async function updateBankAccount(
  merchantId: string,
  bank: {
    account_name: string;
    account_number: string;
    bank_name: string;
    iban?: string;
    swift?: string;
    country?: string;
  }
) {
  const res = await api.put(`/wallet/${merchantId}/bank`, bank);
  return res.data;
}

// ── Payouts ───────────────────────────────────────────────────
export async function requestPayout(
  merchantId: string,
  data: {
    amount: number;
    currency: string;
    bank_account: {
      account_name: string;
      account_number: string;
      bank_name: string;
      iban?: string;
      swift?: string;
    };
    note?: string;
  }
) {
  const res = await api.post(`/wallet/${merchantId}/payout`, data);
  return res.data;
}

export async function getMerchantPayouts(merchantId: string) {
  const res = await api.get(`/wallet/${merchantId}/payouts`);
  return res.data;
}

// ── Admin ─────────────────────────────────────────────────────
export async function getAllPayouts(status?: string) {
  const res = await api.get("/admin/payouts", {
    params: status ? { status } : {}
  });
  return res.data;
}

export async function approvePayout(payoutId: string, stn_code?: string, admin_note?: string) {
  const res = await api.post(`/admin/payouts/${payoutId}/approve`, { stn_code, admin_note });
  return res.data;
}

export async function completePayout(payoutId: string) {
  const res = await api.post(`/admin/payouts/${payoutId}/complete`, {});
  return res.data;
}

export async function rejectPayout(payoutId: string, admin_note: string) {
  const res = await api.post(`/admin/payouts/${payoutId}/reject`, { admin_note });
  return res.data;
}
