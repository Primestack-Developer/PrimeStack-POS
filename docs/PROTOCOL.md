# 📘 101.6 Payment Protocol — Technical Specification

---

## 1. Overview

The 101.6 Protocol is a secure, JSON‑based payment messaging standard used by PrimeStack for:

- Tap to Pay (EMV Contactless)
- MOTO (Manual Entry)
- Online card processing
- Offline transactions
- Settlement & reconciliation
- Refunds, voids, preauth, capture

It is designed for POS terminals, SoftPOS apps, and merchant systems.

---

## 2. Message Structure

### 2.1 Request Format

```json
{
  "protocol": "101.6",
  "message_type": "SALE",
  "transaction_id": "TXN-123456",
  "timestamp": "2026-07-08T06:25:00Z",

  "merchant": {
    "merchant_id": "MRC-10001",
    "store_id": "STR-01",
    "terminal_id": "TERM-ANDROID-0001",
    "country": "AE",
    "currency": "AED"
  },

  "amount": {
    "value": 100.00,
    "currency": "AED"
  },

  "card": {
    "entry_mode": "CONTACTLESS",
    "token": "411111******1111",
    "emv_data": "9F2608A1B2C3D4E5F6",
    "last4": "1111"
  },

  "transaction_flags": {
    "offline": false,
    "moto": false,
    "recurring": false
  },

  "security": {
    "nonce": "N-123456",
    "signature": "BASE64_HMAC",
    "algorithm": "HMAC_SHA256"
  }
}
```

### 2.2 Response Format

```json
{
  "protocol": "101.6",
  "message_type": "SALE_RESPONSE",
  "transaction_id": "TXN-123456",
  "timestamp": "2026-07-08T06:25:01Z",

  "result": {
    "status": "APPROVED",
    "code": "00",
    "description": "Approved",
    "auth_code": "A12345",
    "rrn": "123456789012",
    "stan": "000123"
  },

  "amount": {
    "value": 100.00,
    "currency": "AED"
  },

  "merchant": {
    "merchant_id": "MRC-10001",
    "store_id": "STR-01",
    "terminal_id": "TERM-ANDROID-0001"
  },

  "flags": {
    "offline_stored": false,
    "reversal_required": false
  },

  "security": {
    "nonce": "N-123456",
    "signature": "BASE64_HMAC",
    "algorithm": "HMAC_SHA256"
  }
}
```

---

## 3. Supported Message Types

| Type      | Description                                  |
|-----------|----------------------------------------------|
| `SALE`    | Standard purchase                             |
| `REFUND`  | Reverse a previous SALE                       |
| `VOID`    | Cancel SALE before settlement                 |
| `PREAUTH` | Hold funds                                    |
| `CAPTURE` | Finalize PREAUTH                              |
| `PING`    | Health check                                  |

---

## 4. Security

### 4.1 HMAC-SHA256

All messages must be signed using:

```
HMAC-SHA256(Base64(JSON_without_security), terminal_secret_key)
```

### 4.2 Nonce

Prevents replay attacks.

### 4.3 AES-256 Vault

PAN is encrypted and replaced with a token.

---

## 5. Offline Mode

- POS stores transactions locally
- Syncs when online
- Server marks offline transactions
- Reversals handled automatically

---

## 6. Settlement

- Daily batch
- Approved totals
- Declined totals
- RRN/STAN mapping
- Exportable reports

---

## 7. Reconciliation

- Match acquirer records
- Detect missing transactions
- Detect mismatches
- Generate reconciliation batch

---

## 8. Webhooks

- Transaction webhook
- Settlement webhook
- Chargeback webhook

---

## 9. Error Codes

| Code | Meaning                              |
|------|--------------------------------------|
| 00   | Approved                             |
| 05   | Declined                             |
| 99   | Pending                              |
| F1   | Fraud                                |
| R1   | High risk                            |
| 404  | Original transaction not found       |
