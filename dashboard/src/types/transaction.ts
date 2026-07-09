export interface Transaction {
  _id: string;
  transaction_id: string;
  timestamp: string;
  merchant: {
    merchant_id: string;
    store_id: string;
    terminal_id: string;
    country: string;
    currency: string;
  };
  amount: {
    value: number;
    currency: string;
  };
  card: {
    entry_mode: string;
    last4?: string;
    token?: string;
    pan?: string;
    expiry_month?: string;
    expiry_year?: string;
    cvv_present?: boolean;
  };
  result: {
    status: string;
    code: string;
    description: string;
    auth_code?: string;
    rrn?: string;
    stan?: string;
  };
  flags?: {
    offline_stored: boolean;
    reversal_required: boolean;
  };
  transaction_flags?: {
    offline: boolean;
    moto: boolean;
    recurring: boolean;
  };
  created_at: string;
}
