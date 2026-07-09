export interface MerchantInfo {
  merchant_id: string;
  store_id: string;
  terminal_id: string;
  country: string;
  currency: string;
}

export interface AmountInfo {
  value: number;
  currency: string;
}

export interface CardInfo {
  entry_mode: "CONTACTLESS" | "CHIP" | "MAGSTRIPE" | "MOTO";
  pan?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv_present?: boolean;

  token?: string;
  emv_data?: string;
  last4?: string;
}

export interface TransactionFlags {
  offline: boolean;
  moto: boolean;
  recurring: boolean;
}

export interface SecurityInfo {
  nonce: string;
  signature: string;
  algorithm: "HMAC_SHA256";
}

export interface MetadataInfo {
  pos_app_version?: string;
  os?: string;
  note?: string;
}

export interface Protocol1016Request {
  protocol: "101.6";
  message_type: "SALE" | "REFUND" | "VOID" | "PREAUTH" | "CAPTURE" | "PING" | "CASH_OUT";
  transaction_id: string;
  timestamp: string;

  merchant: MerchantInfo;
  amount: AmountInfo;
  card: CardInfo;

  transaction_flags: TransactionFlags;
  customer?: {
    language?: string;
    email?: string | null;
    phone?: string | null;
  };

  security: SecurityInfo;
  metadata?: MetadataInfo;
}

export interface Protocol1016Response {
  protocol: "101.6";
  message_type: string;
  transaction_id: string;
  timestamp: string;

  result: {
    status: "APPROVED" | "DECLINED" | "ERROR" | "PENDING";
    code: string;
    description: string;
    auth_code?: string | null;
    rrn?: string | null;
    stan?: string | null;
  };

  amount?: AmountInfo;
  merchant?: MerchantInfo;

  card?: {
    scheme?: string;
    last4?: string;
    token?: string;
  };

  flags?: {
    offline_stored: boolean;
    reversal_required: boolean;
  };

  security?: SecurityInfo;
}
