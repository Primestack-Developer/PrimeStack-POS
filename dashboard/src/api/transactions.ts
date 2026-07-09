import { api } from "./client";

export async function getTransactions(merchantId?: string) {
  const params = merchantId ? { merchant_id: merchantId } : {};
  const res = await api.get("/transactions", { params });
  return res.data;
}

export async function getTransaction(id: string) {
  const res = await api.get(`/transactions/${id}`);
  return res.data;
}
