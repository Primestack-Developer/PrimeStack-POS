// ─────────────────────────────────────────────────────────────
// PrimeStack 101.6 — CASH-OUT / External Issuer Types
// ─────────────────────────────────────────────────────────────

// POS → Your 101.6 processor
export interface CashOutRequest {
  protocol: "101.6";
  message_type: "CASH_OUT";
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

  // Identifies which external server to call and whose wallet to debit
  external_issuer: {
    server_id: string;      // e.g. "SRV-ABC123"  — registered external server
    user_id: string;        // e.g. "USER-789"     — account on that server
  };

  transaction_flags: {
    offline: boolean;
    external_issuer: true;  // always true for CASH_OUT
  };

  security: {
    nonce: string;
    signature: string;
    algorithm: "HMAC_SHA256";
  };

  metadata?: {
    pos_app_version?: string;
    os?: string;
    note?: string;
  };
}

// Your processor → External issuer server
export interface ExternalDebitRequest {
  request_type: "DEBIT";
  user_id: string;
  amount: number;
  currency: string;
  pos_reference: string;    // your transaction_id
  pos_terminal_id: string;
  idempotency_key?: string; // prevents double debit on retry
}

// External issuer server → Your processor
export interface ExternalDebitResponse {
  approved: boolean;
  issuer_reference?: string;  // their internal reference, e.g. "ISS-998877"
  message: string;
  balance_after?: number;     // optional, issuer may include remaining balance
  error_code?: string;        // populated when approved = false
}

// Your 101.6 processor → POS
export interface CashOutResponse {
  protocol: "101.6";
  message_type: "CASH_OUT_RESPONSE";
  transaction_id: string;
  timestamp: string;

  result: {
    status: "APPROVED" | "DECLINED" | "ERROR";
    code: string;
    description: string;
    auth_code?: string;
    rrn?: string;
    stan?: string;
    issuer_reference?: string;  // forwarded from external server
    balance_after?: number;     // forwarded from external server (optional)
  };

  amount: {
    value: number;
    currency: string;
  };

  external_issuer: {
    server_id: string;
    user_id: string;
  };

  security?: {
    nonce: string;
    signature: string;
    algorithm: "HMAC_SHA256";
  };
}
