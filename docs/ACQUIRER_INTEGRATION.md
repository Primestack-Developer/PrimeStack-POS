# ⭐ Step 48 — Acquirer Integration Guide

---

## 📌 1. Routing

Use the `routeToAcquirer(msg)` function to select an acquirer based on BIN or other factors.

---

## 📌 2. NMI Example

```typescript
POST `https://secure.networkmerchants.com/api/transact.php`
```

---

## 📌 3. Shift4 Example

```typescript
POST `https://api.shift4.com/charges`
```

---

## 📌 4. Amex Direct

```typescript
POST `https://api.americanexpress.com/payments`
```

---

## 📌 5. Response Mapping

Map acquirer response → 101.6 response:

```typescript
const mapResponse = (acquirerResponse: any): Protocol1016Response => {
  return {
    protocol: "101.6",
    message_type: "SALE_RESPONSE",
    transaction_id: "...",
    timestamp: "...",
    result: {
      status: acquirerResponse.approved ? "APPROVED" : "DECLINED",
      code: acquirerResponse.responseCode,
      description: acquirerResponse.message,
      auth_code: acquirerResponse.authCode,
      rrn: acquirerResponse.rrn,
      stan: acquirerResponse.stan
    }
  };
};
```
