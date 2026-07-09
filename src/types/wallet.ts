// ─────────────────────────────────────────────────────────────
// PrimeStack 101.6 — Offline Wallet State Types
//
// Problem this solves:
//   A CASH_OUT goes offline after the POS builds the request.
//   The external issuer was never called, so the customer's wallet
//   was NOT debited. When back online the processor must call the
//   issuer ONCE and ONLY ONCE — no double debit.
//
// State machine for an offline cash-out:
//
//   CREATED → queued on POS device, issuer not called yet
//      ↓  (sync attempt)
//   DEBIT_SENT → processor called issuer, waiting for response
//      ↓ approved
//   DEBIT_CONFIRMED → issuer approved, cash can be given
//      ↓ declined / error
//   DEBIT_FAILED → issuer declined, do NOT give cash
//
//   If DEBIT_SENT but no response (timeout/crash during sync):
//   → backend checks idempotency key with issuer on retry
//   → resolves to DEBIT_CONFIRMED or DEBIT_FAILED
// ─────────────────────────────────────────────────────────────

export type OfflineWalletStatus =
  | "CREATED"           // stored on POS, issuer not contacted
  | "DEBIT_SENT"        // processor called issuer, awaiting response
  | "DEBIT_CONFIRMED"   // issuer approved — cash was / should be given
  | "DEBIT_FAILED"      // issuer declined — do NOT give cash
  | "VOID_SENT"         // reversal sent to issuer (operator cancelled)
  | "VOID_CONFIRMED"    // issuer confirmed reversal — money returned
  | "VOID_FAILED";      // reversal failed — requires manual resolution

export interface OfflineWalletRecord {
  // Identifiers
  transaction_id:  string;     // matches CashOutRequest.transaction_id
  idempotency_key: string;     // stable key sent to issuer — prevents double debit on retry
  server_id:       string;     // which external issuer
  user_id:         string;     // which user on that issuer
  terminal_id:     string;

  // Amount
  amount:   number;
  currency: string;

  // State
  status:          OfflineWalletStatus;
  issuer_reference?: string;   // filled once issuer approves
  issuer_error?:     string;   // filled if issuer declines
  balance_after?:    number;   // filled if issuer includes it
  attempts:          number;   // how many times we've tried

  // Timestamps
  created_at:    Date;
  sent_at?:      Date;
  confirmed_at?: Date;
  voided_at?:    Date;
}

// What the processor sends to the issuer on sync (includes idempotency_key)
export interface OfflineDebitRequest {
  request_type:    "DEBIT";
  user_id:         string;
  amount:          number;
  currency:        string;
  pos_reference:   string;   // transaction_id
  pos_terminal_id: string;
  idempotency_key: string;   // issuer must use this to deduplicate
}

// What the processor sends to the issuer for reversal
export interface OfflineVoidRequest {
  request_type:    "VOID";
  user_id:         string;
  amount:          number;
  currency:        string;
  pos_reference:   string;
  idempotency_key: string;
  original_issuer_reference: string;
}
