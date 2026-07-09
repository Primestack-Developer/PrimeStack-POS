# PrimeStack Android POS — Build Guide v2.0

> **App Version:** 2.0 | **Protocol:** 101.6 | **Min Android:** 7.0 (API 24)
> **Last Updated:** July 2026

---

## Payment Processor Status: ✅ Ready for Deploy

| Component | Status |
|---|---|
| 101.6 SALE / REFUND / VOID / PREAUTH / CAPTURE | ✅ Live |
| MOTO card entry (auto-formatted PAN + expiry) | ✅ Live |
| HMAC-SHA256 per-terminal signing | ✅ Live |
| PAN tokenization AES-256 (PCI) | ✅ Live |
| Fraud detection + risk scoring | ✅ Live |
| Acquirer routing (Visa/MC/Amex/Discover/UnionPay) | ✅ Live |
| Merchant internal wallet — auto-credited on SALE | ✅ Live |
| Payout request to bank (merchant → admin review) | ✅ Live |
| CASH-OUT / external issuer withdrawal | ✅ Live |
| Offline queue — Room DB, real sync | ✅ Live |
| Offline wallet state machine (no double debit) | ✅ Live |
| Settlement engine daily/weekly/monthly | ✅ Live |
| Reconciliation + chargeback + webhooks | ✅ Live |
| NFC tap-to-pay | ⏳ Activate when NFC ready |

---

## What's New in v2.0

### Merchant Wallet (new)
Every approved MOTO sale **automatically credits** the merchant's internal PrimeStack wallet. Money never goes anywhere else until the merchant requests a payout. The wallet screen on the POS shows:
- Live balance
- Total received / total paid out
- Payout request form (amount + bank account details)

### Real Offline Transactions
- Network failure → transaction stored in Room DB on device
- SYNC button (Home screen or Settings) sends all pending records to backend
- CASH-OUT offline uses a state machine — wallet debit happens exactly once on sync, never twice

### Configurable Server URL
Settings screen → enter your production server URL once → all transactions route there automatically. Survives logout.

---

## How to Build the APK

### Option 1 — Android Studio (Recommended)

1. Open **Android Studio**
2. `File` → `Open` → select the `android/` folder:
   ```
   c:\Users\metat\Downloads\primestack Protocol\android
   ```
3. Wait for **Gradle sync** to complete (first time downloads ~200MB of dependencies — needs internet once)
4. `Build` → `Generate Signed Bundle / APK`
5. Select **APK** → click **Next**
6. **Key store path:** `android/primestack.keystore`  
   **Key store password:** `PrimeStack2026!`  
   **Key alias:** `primestack`  
   **Key password:** `PrimeStack2026!`
7. Select **release** build variant → click **Finish**
8. APK output: `android/app/release/app-release.apk`

### Option 2 — Command Line (needs internet for first run)

Open **Command Prompt** (not PowerShell) and run:

```batch
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_HOME=C:\Users\metat\AppData\Local\Android\Sdk
cd "c:\Users\metat\Downloads\primestack Protocol\android"
gradlew.bat assembleRelease
```

Output: `android/app/release/app-release.apk`

> After the first successful build, all dependencies are cached. Future builds work offline.

---

## Keystore Details

| Field | Value |
|---|---|
| File | `android/primestack.keystore` |
| Password | `PrimeStack2026!` |
| Alias | `primestack` |
| Key password | `PrimeStack2026!` |
| Validity | 25 years |
| Entity | PrimeStack Technologies, Dubai, AE |

> ⚠️ For production: replace with strong passwords and store in a secrets manager. Never commit keystore passwords to version control.

---

## Project Structure

```
android/
├── app/
│   ├── build.gradle.kts              # App build config (v2.0, KSP, AGP 8.7.3)
│   ├── proguard-rules.pro
│   ├── release/
│   │   └── app-release.apk           # Pre-built APK (v1.0 — rebuild for v2.0)
│   └── src/main/
│       ├── kotlin/com/primestack/taptopay/
│       │   ├── SplashActivity.kt              # Launch → register or home
│       │   ├── DeviceRegistrationActivity.kt  # Terminal onboarding
│       │   ├── HomeActivity.kt                # Main menu (7 buttons)
│       │   ├── AmountActivity.kt              # Numeric keypad
│       │   ├── PaymentMethodActivity.kt       # NFC or MOTO selection
│       │   ├── MotoActivity.kt                # Manual card entry + offline fallback
│       │   ├── TapToPayActivity.kt            # NFC/EMV (activate when ready)
│       │   ├── CashOutActivity.kt             # External issuer withdrawal
│       │   ├── WalletActivity.kt              # Merchant wallet balance + payout
│       │   ├── ResultActivity.kt              # Approval / decline result
│       │   ├── TransactionHistoryActivity.kt  # Offline transaction list
│       │   ├── SettingsActivity.kt            # Server URL + sync + logout
│       │   ├── HmacUtil.kt                    # HMAC-SHA256 signing
│       │   ├── PrefsManager.kt                # SharedPreferences (URL, creds)
│       │   ├── OfflineSyncManager.kt          # Room DB save + sync logic
│       │   └── data/db/
│       │       ├── AppDatabase.kt
│       │       ├── dao/OfflineDao.kt
│       │       └── entity/OfflineTransaction.kt
│       ├── res/layout/                        # 12 XML layouts
│       └── AndroidManifest.xml
├── build.gradle.kts                  # AGP 8.7.3, Kotlin 2.0.21, KSP 2.0.21-1.0.28
├── settings.gradle.kts
├── gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties     # Gradle 8.9
├── gradlew / gradlew.bat
├── keystore.properties
└── primestack.keystore
```

---

## Build Variants

| Variant | App ID | Notes |
|---|---|---|
| Debug | `com.primestack.taptopay.debug` | Debuggable, logcat enabled |
| Release | `com.primestack.taptopay` | Signed, production-ready |

---

## First-Time Device Setup (on the Android device)

1. Install the APK (enable "Install from unknown sources" if not from Play Store)
2. Open the app → **Register This Device** screen appears
3. Enter your **Merchant ID** (must already be registered on the backend via `POST /merchant/register`)
4. Tap **REGISTER DEVICE** → the app calls `POST /merchant/register-terminal` and saves the terminal secret automatically
5. You land on the **Home** screen — ready to take payments

> If the backend server is not `10.0.2.2:4000` (emulator default), go to **Settings** first and set your real server URL before registering.

---

## Home Screen Buttons

| Button | What it does |
|---|---|
| NEW SALE | Amount → payment method → NFC or MOTO |
| MOTO ENTRY | Amount → manual card entry → charge |
| TAP TO PAY | Amount → NFC tap (activate when NFC ready) |
| TRANSACTIONS | View offline transaction history from device |
| CASH-OUT / WITHDRAW | External issuer withdrawal (CASH_OUT flow) |
| MY WALLET | View merchant wallet balance, request payout |
| SYNC OFFLINE | Send all queued offline transactions to backend |
| SETTINGS | Server URL, sync, logout |

---

## Deploy Checklist

- [ ] Backend running with `npm run build && npm start` (or PM2)
- [ ] MongoDB connected and merchants registered
- [ ] `VAULT_KEY` set in `.env` (AES-256 key for PAN encryption)
- [ ] Server URL set in app Settings (HTTPS for production)
- [ ] `POST /merchant/register` called for each merchant
- [ ] Device registered from the app (auto-generates terminal secret)
- [ ] Signed APK installed on POS device
- [ ] Test a MOTO sale and verify wallet balance updates on dashboard

---

*PrimeStack Technologies — Dubai, UAE*
