# PrimeStack 101.6 Protocol Documentation

## 1. Message Structure

### Message Types
| Type      | Description                                      |
|-----------|--------------------------------------------------|
| `SALE`    | Standard purchase transaction                     |
| `REFUND`  | Refund a previously processed transaction        |
| `VOID`    | Cancel a transaction before settlement           |
| `PREAUTH` | Hold funds without finalizing the purchase       |
| `CAPTURE` | Finalize a previously authorized PREAUTH         |
| `PING`    | System health check and HMAC verification        |

### Request Format

```json
{
  "protocol": "101.6",
  "message_type": "SALE",
  "transaction_id": "TXN-12345",
  "timestamp": "2026-07-08T12:34:56Z",
  "merchant": {
    "merchant_id": "MCH-001",
    "store_id": "STR-001",
    "terminal_id": "TRM-001",
    "country": "AE",
    "currency": "AED"
  },
  "amount": {
    "value": 100.00,
    "currency": "AED"
  },
  "card": {
    "entry_mode": "CONTACTLESS",
    "pan": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "28",
    "cvv_present": true,
    "token": "411111XXXXXX1111",
    "emv_data": "9F2608A1B2C3D4E5F6A7B89F370400000001",
    "last4": "1111"
  },
  "transaction_flags": {
    "offline": false,
    "moto": false,
    "recurring": false
  },
  "customer": {
    "language": "en",
    "email": "customer@example.com",
    "phone": "+971501234567"
  },
  "security": {
    "nonce": "abc123xyz",
    "signature": "3a2f9e8c7d6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f",
    "algorithm": "HMAC_SHA256"
  },
  "metadata": {
    "pos_app_version": "1.0.0",
    "os": "Android 14",
    "note": "Order #123"
  }
}
```

### Response Format

```json
{
  "protocol": "101.6",
  "message_type": "SALE_RESPONSE",
  "transaction_id": "TXN-12345",
  "timestamp": "2026-07-08T12:34:57Z",
  "result": {
    "status": "APPROVED",
    "code": "00",
    "description": "Approved",
    "auth_code": "A1B2C3",
    "rrn": "RR1234567890",
    "stan": "123ABC"
  },
  "amount": {
    "value": 100.00,
    "currency": "AED"
  },
  "merchant": {
    "merchant_id": "MCH-001",
    "store_id": "STR-001",
    "terminal_id": "TRM-001",
    "country": "AE",
    "currency": "AED"
  },
  "card": {
    "scheme": "VISA",
    "last4": "1111",
    "token": "TKN-8a7b6c5d4e3f"
  },
  "flags": {
    "offline_stored": false,
    "reversal_required": false
  },
  "security": {
    "nonce": "abc123xyz",
    "signature": "d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f",
    "algorithm": "HMAC_SHA256"
  }
}
```

## 2. Security

### HMAC-SHA256 Signing
- All requests and responses must be signed with HMAC-SHA256 using the terminal secret key
- The `security` field (including nonce, signature, and algorithm) should be removed before generating the signature
- Signatures must be verified before processing any request

### Nonce
- Each request must include a unique `nonce` to prevent replay attacks
- Nonces should be random strings of sufficient length (at least 16 characters)

## 3. Card Data

### Accepted Entry Modes
| Mode          | Description                                      |
|---------------|--------------------------------------------------|
| `CONTACTLESS` | Tap to pay (EMV contactless)                     |
| `CHIP`        | EMV chip and PIN                                 |
| `MAGSTRIPE`   | Magnetic stripe                                  |
| `MOTO`        | Mail order / telephone order                     |

### Stored Data
- **EMV Token:** Encrypted card token from chip
- **Cryptogram:** Cryptographic data from EMV chip
- **PAN (MOTO only):** For manual entry only, tokenized immediately
- **Vault Token:** Token from our secure AES-256 encrypted vault

### PCI Compliance
- PAN must never be stored unencrypted
- CVV must never be stored
- For MOTO transactions, PAN is tokenized immediately and removed from transaction records
- Token storage uses AES-256-CBC with a secure vault key

## 4. Merchant Data

| Field         | Description                                      |
|---------------|--------------------------------------------------|
| `merchant_id` | Unique identifier for the merchant               |
| `store_id`    | Unique identifier for the store or location       |
| `terminal_id` | Unique identifier for the POS terminal           |
| `country`     | Merchant country code (ISO 3166-1 alpha-2)       |
| `currency`    | Merchant default currency (ISO 4217)             |

## 5. Response Codes

| Code | Status       | Description                                      |
|------|--------------|--------------------------------------------------|
| 00   | APPROVED     | Transaction approved successfully               |
| 05   | DECLINED     | Transaction declined by issuer                   |
| 99   | PENDING      | Transaction pending further processing           |
| F1   | DECLINED     | Fraud check failed                               |
| R1   | DECLINED     | High risk score detected                         |
| 404  | ERROR        | Original transaction not found                   |

## 6. Offline Behavior

### Offline Queue
- Transactions are stored locally on the POS terminal if network is unavailable
- Transactions are automatically synced with the server when connection is restored
- Synced transactions are sent in the order they were received

### Sync Mechanism
- POS checks for network connectivity every 5 seconds
- When online, POS sends all queued transactions to `/1016/transaction`
- Server processes each transaction and responds with status
- POS removes successfully synced transactions from queue

### Reversal Rules
- If a transaction is stored offline, `flags.offline_stored` is `true`
- When synced, server checks for any reversals needed based on final status
- Reversals are automatically queued and sent if needed

## 7. Settlement

### Settlement Batches
| Period    | Endpoint                               |
|-----------|----------------------------------------|
| Daily     | POST `/settlement/daily/:merchant_id`   |
| Weekly    | POST `/settlement/weekly/:merchant_id`  |
| Monthly   | POST `/settlement/monthly/:merchant_id` |

### Settlement Batch Structure
```json
{
  "batch_id": "BATCH-1720425600-MCH-001",
  "merchant_id": "MCH-001",
  "terminal_id": "TRM-001",
  "date": "2026-07-08",
  "period": "daily",
  "totals": {
    "approved_count": 15,
    "approved_amount": 5000.00,
    "declined_count": 2,
    "declined_amount": 300.00,
    "total_count": 17,
    "total_amount": 5300.00
  },
  "transactions": ["66a123456789abcdef123456", "66a123456789abcdef123457"],
  "created_at": "2026-07-08T23:59:59Z"
}
```

### Export
- JSON: GET `/settlement/:batch_id/export?format=json`
- CSV: GET `/settlement/:batch_id/export?format=csv`

### Reconciliation
Reconciliation batches match system transactions with acquirer records using:
- RRN (Retrieval Reference Number)
- STAN (System Trace Audit Number)
- Transaction ID

Reconciliation endpoint: POST `/reconciliation/:merchant_id`

## 8. Webhooks

### Transaction Webhook
Sent immediately after a transaction is processed

### Settlement Webhook
Sent when a settlement batch is generated

### Chargeback Webhook
Sent when a chargeback is created

### Registering Webhooks
- POST `/webhook/register` with `merchant_id` and `url`
- GET `/webhook/:merchant_id` to retrieve registered webhook

---

## PCI Compliance Checklist

✅ Firewall between public and private networks  
✅ No direct DB exposure  
✅ TLS 1.2+ enforced  
✅ No weak ciphers  
✅ PAN stored only as encrypted (AES-256) tokens  
✅ EMV token allowed  
✅ Last4 allowed  
✅ No CVV storage  
✅ HMAC-SHA256 for message integrity  
✅ AES-256 for vault storage  
