# ⭐ Step 46 — Developer API Reference

---

## 📌 POST /1016/transaction

### Description
Process a 101.6 payment message.

### Request
JSON (signed with HMAC).

### Response
JSON (signed with HMAC).

### Errors
- **400** — Invalid protocol
- **401** — Invalid signature
- **404** — Transaction not found
- **500** — Internal error

---

## 📌 POST /merchant/register

### Description
Registers a merchant.

### Request Body
```json
{
  "merchant_id": "MRC-10001",
  "name": "PrimeStack Merchant",
  "country": "AE",
  "currency": "AED"
}
```

---

## 📌 POST /merchant/register-terminal

### Description
Creates a terminal + secret key.

### Request Body
```json
{
  "merchant_id": "MRC-10001",
  "terminal_id": "TERM-001"
}
```

---

## 📌 GET /transactions

### Description
Returns all transactions.

### Query Parameters
- `merchant_id` (optional) — Filter by merchant
- `terminal_id` (optional) — Filter by terminal

---

## 📌 GET /transactions/:id

### Description
Returns a single transaction.

---

## 📌 POST /settlement/daily/:merchant_id
## 📌 POST /settlement/weekly/:merchant_id
## 📌 POST /settlement/monthly/:merchant_id

### Description
Generates settlement batches by period.

---

## 📌 GET /settlement/:merchant_id

### Description
Returns all settlement batches for a merchant.

---

## 📌 GET /settlement/:batch_id/export

### Description
Exports a settlement batch.

### Query Parameters
- `format` (optional) — `json` or `csv` (default: `json`)

---

## 📌 POST /reconciliation/:merchant_id

### Description
Reconciles transactions with acquirer records.

---

## 📌 GET /reconciliation/:merchant_id

### Description
Returns all reconciliation batches.

---

## 📌 POST /webhook/register

### Description
Registers a merchant webhook URL.

### Request Body
```json
{
  "merchant_id": "MRC-10001",
  "url": "https://example.com/webhook"
}
```

---

## 📌 GET /webhook/:merchant_id

### Description
Retrieves the registered webhook for a merchant.

---

## 📌 POST /chargeback/create

### Description
Creates a new chargeback case.

---

## 📌 GET /chargeback/:merchant_id

### Description
Returns all chargebacks for a merchant.
