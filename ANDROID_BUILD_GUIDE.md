# PrimeStack 101.6 — Complete System Guide

> **Version:** 2.0 | **Last Updated:** July 2026
> **Backend:** https://primestack-pos.onrender.com
> **Dashboard:** https://primestack-dashboard.onrender.com

---

## System Status

| Component | Status |
|---|---|
| Backend API (Render) | ✅ Live |
| Dashboard (Render) | ✅ Live |
| MongoDB Atlas | ✅ Connected |
| Stripe Integration | ✅ Wired (key must be set in Render) |
| Wise Payout API | ✅ Wired |
| Stripe Webhook | ✅ Handler live at /webhooks/stripe |
| Wise Webhook | ✅ Handler live at /webhooks/wise |
| Android APK | ⚠️ Rebuild required for latest changes |

---

## Admin Login

| Field | Value |
|---|---|
| URL | https://primestack-dashboard.onrender.com/login |
| Email | admin@primestack.com |
| Password | admin123 |
| Private Key (recovery) | 4af5130083e8f7b200d4a1193c50818cb11dd786b13da2819d214f57e3c42287 |

---

## Render Environment Variables — Required

Go to **Render → primestack-pos → Environment** and ensure these are all set with NO leading spaces:

```
PORT=4000
MONGO_URI=mongodb+srv://ajialosious9:RV0dOc1JSEtlJzfH@cluster0.ibibux.mongodb.net/primestack1016?retryWrites=true&w=majority&appName=Cluster0
VAULT_KEY=1faedc0c18502904abbec9dfcb75bfea5c35c2a86ccd6fcf448ed7acfcca4c82
JWT_SECRET=a3ce3133e920a5e38f8fc45f800c80275693d90d94f436c779911558908f5850
ADMIN_EMAIL=admin@primestack.com
ADMIN_PASSWORD=admin123
ADMIN_PRIVATE_KEY=4af5130083e8f7b200d4a1193c50818cb11dd786b13da2819d214f57e3c42287
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51TfkbbDaH8uxzhARWRUoK0ggvO3LYzYA74BU76JiMblGKxv0VKqPJCkE02pBe0Jkm564nQ5R8C67Ao1FzDzyThI200rHdz5x1T
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
WISE_API_KEY=6881f52b-7efe-4cc6-aee3-f322195c9add
FLOOR_LIMIT_AED=100
OFFLINE_NFC_ENABLED=true
```

⚠️ **CRITICAL:** `STRIPE_SECRET_KEY` must have NO space before `sk_live_`. A leading space was causing all payments to fail silently.

---

## Render Dashboard Environment — Required

Go to **Render → primestack-dashboard → Environment**:

```
REACT_APP_API_URL=https://primestack-pos.onrender.com
```

---

## Android App — Build Instructions

### Prerequisites
- Android Studio (latest)
- Gradle sync requires internet for first run

### Steps
1. Open Android Studio → `File` → `Open` → select `android/` folder
2. Let Gradle sync complete
3. If Kotlin version error → click **Quick Fix** → Android Studio auto-corrects
4. `Build` → `Generate Signed Bundle / APK` → `APK` → `release`
5. Keystore: `primestack.keystore` | Password: `PrimeStack2026!`

### First-time device setup
1. Install APK on device
2. **Registration screen:**
   - Server URL: `https://primestack-pos.onrender.com`
   - Merchant ID: `MRC-10001`
   - Device ID: auto-filled
   - OR enter Secret Key if you have it (skips server registration)
3. Tap **REGISTER DEVICE**

---

## Payment Flow — How Real Money Moves

### MOTO (Manual Card Entry) — Online
```
1. Enter card number, expiry, CVV (optional)
2. App fetches Stripe publishable key from backend
3. App sends card data to Stripe API → gets pm_xxx token
   (card number NEVER touches your server)
4. pm_xxx sent to your backend
5. Backend calls Stripe with secret key to confirm charge
6. Real money charged ✅ → appears in Stripe Dashboard
7. Wallet balance updated automatically ✅
8. STN code on receipt ✅
```

### MOTO — Offline
```
1. Enter card → no internet
2. Stored in device Room DB ✅
3. Receipt with STN code ✅
4. Press SYNC OFFLINE when connected
5. Sent to backend → wallet credited
```

### NFC Tap — Online
```
1. Tap card → EMV data read
2. Backend processes — approves at protocol level
   (full NFC charging needs acquirer integration)
```

### NFC Tap — Offline (Floor Limit ≤ AED 100)
```
1. Tap card → no internet
2. Amount ≤ AED 100: Auto-approved ✅ stored in DB ✅
3. Amount > AED 100: Rejected (too risky offline)
4. SYNC when online → wallet credited
```

---

## Dashboard Features

| Page | URL | What it does |
|---|---|---|
| Dashboard | / | Live stats, recent transactions |
| Transactions | /transactions | All transactions with detail view |
| Terminals | /terminals | Register/delete terminals — shows IDs to use in app |
| Merchants | /merchant | Register/delete merchants |
| 💳 Wallets | /wallet | Merchant wallet balance, ledger, payout request |
| 💸 Payouts | /admin/payouts | Approve payouts (requires STN code) |
| 🏦 Admin Cashout | /admin/cashout | Admin treasury cashout with STN verification |
| 📵 Offline Queue | /offline | View/sync all offline transactions |
| Cash-Outs | /cashout | External issuer cash-out history |

---

## STN Code System

Every approved payment generates a **6-digit STN code** on the receipt.

```
Customer pays → STN: 847291 on receipt
Merchant keeps receipt
Admin needs to approve payout → must enter STN code
System verifies → STN matches transaction → approved
STN marked used — cannot be reused
```

---

## Payout Flow (Wise)

```
Merchant requests payout from Wallet page
        ↓
Admin sees PENDING in Payouts page
Admin asks merchant for STN code from receipt
Admin enters STN + clicks "Verify STN & Approve"
        ↓
System debits wallet balance
Wise API called → real money sent to merchant's bank
        ↓
Payout auto-marked COMPLETED when Wise webhook fires
```

---

## Offline Queue

- View at Dashboard → **📵 Offline Queue**
- Click **🔄 Sync Now** to process all pending transactions
- Android home screen shows red sync button with count when pending

---

## Webhook Endpoints

| Webhook | URL | Purpose |
|---|---|---|
| Stripe | POST /webhooks/stripe | Confirm charges, update wallet |
| Wise | POST /webhooks/wise | Auto-complete payouts |

### Stripe webhook setup
1. https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://primestack-pos.onrender.com/webhooks/stripe`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy `whsec_...` → add to Render as `STRIPE_WEBHOOK_SECRET`

---

## Known Limitations

| Item | Status | Notes |
|---|---|---|
| NFC real charge | ⚠️ Protocol only | Needs Visa/MC acquirer API for cryptogram verification |
| Wise payout | ✅ Wired | Needs active Wise balance and valid API key |
| Floor limit NFC offline | ✅ AED 100 default | Configure via `FLOOR_LIMIT_AED` in Render |

---

## Recent Fixes (Latest)

1. **CRITICAL** — Stripe `STRIPE_SECRET_KEY` had a leading space causing all payments to fail. Fixed in `.env` and must be fixed in Render too.
2. Race condition — pay button now disabled until Stripe key is loaded from server
3. `last4` now included in MOTO transaction records
4. Offline HMAC — offline transactions skip HMAC verification (signed at transaction time)
5. Finix demo processor removed — Stripe is now the only payment processor
6. Transaction type screen — 2×2 grid (SALE/PRE-AUTH/VOID/REFUND), full-width ONLINE/OFFLINE buttons
7. MOTO layout — ScrollView added, Pay button always visible

---

*PrimeStack Technologies — Dubai, UAE*
