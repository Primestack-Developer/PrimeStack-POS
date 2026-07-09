export interface Terminal {
  terminal_id: string;
  secret_key: string;
  status: string;
  _id?: string;
}

export interface Merchant {
  _id: string;
  merchant_id: string;
  name: string;
  country: string;
  currency: string;
  terminals: Terminal[];
  created_at: string;
}
