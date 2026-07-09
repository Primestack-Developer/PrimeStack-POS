# ⭐ Step 47 — POS Integration Guide

---

## 📌 1. Initialize POS

1. Load terminal secret key
2. Load merchant profile
3. Enable NFC

---

## 📌 2. Tap to Pay Flow

1. Detect NFC tag
2. Send APDU commands
3. Extract EMV cryptogram
4. Build 101.6 SALE
5. Sign with HMAC
6. Send to backend
7. Display result

---

## 📌 3. MOTO Flow

1. Enter PAN + expiry
2. Build 101.6 SALE
3. Vault encrypt PAN
4. Replace with token
5. Send to backend

---

## 📌 4. Offline Flow

1. Store message locally
2. Auto‑sync every 5 seconds
3. Display “Stored Offline”

---

## Security Notes

- Always sign messages with terminal secret key
- Never store unencrypted PAN
- CVV must never be stored
