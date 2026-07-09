import { api } from "./client";

export async function getMerchants() {
  const res = await api.get("/merchants");
  return res.data;
}

export async function getMerchant(id: string) {
  const res = await api.get(`/merchants/${id}`);
  return res.data;
}

export async function getTerminals(merchantId: string) {
  const res = await api.get(`/merchants/${merchantId}/terminals`);
  return res.data;
}

export async function registerMerchant(merchantData: {
  merchant_id: string;
  business_name: string;
  email: string;
}) {
  const res = await api.post("/merchant/register", merchantData);
  return res.data;
}

export async function registerTerminal(terminalData: {
  merchant_id: string;
  terminal_id: string;
}) {
  const res = await api.post("/merchant/register-terminal", terminalData);
  return res.data;
}
