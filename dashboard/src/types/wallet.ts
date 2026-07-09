export type WalletStatus = "ACTIVE" | "FROZEN" | "SUSPENDED";
export type LedgerType   = "CREDIT" | "DEBIT" | "REFUND" | "FEE" | "REVERSAL";
export type PayoutStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

export interface MerchantWallet {
  _id:             string;
  merchant_id:     string;
  merchant_name:   string;
  currency:        string;
  balance:         number;
  pending_balance: number;
  total_credited:  number;
  total_debited:   number;
  status:          WalletStatus;
  bank_account?: {
    account_name:   string;
    account_number: string;
    bank_name:      string;
    iban?:          string;
    swift?:         string;
    country?:       string;
  };
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  _id:            string;
  merchant_id:    string;
  transaction_id: string;
  type:           LedgerType;
  amount:         number;
  currency:       string;
  balance_before: number;
  balance_after:  number;
  description:    string;
  created_at:     string;
}

export interface PayoutRequest {
  _id:        string;
  payout_id:  string;
  merchant_id: string;
  amount:     number;
  currency:   string;
  bank_account: {
    account_name:   string;
    account_number: string;
    bank_name:      string;
    iban?:          string;
    swift?:         string;
  };
  status:       PayoutStatus;
  note?:        string;
  admin_note?:  string;
  requested_at: string;
  processed_at?: string;
}
