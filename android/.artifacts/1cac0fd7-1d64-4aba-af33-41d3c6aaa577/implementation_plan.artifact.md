# Remove Mock and Demo Transactions Logic

The user wants to remove all "mock" or "demo" transactions from the project. Based on the recent changes and code analysis, this refers to the **offline transaction storage** and **floor limit approval** features, which allow simulating successful transactions locally when the server is unreachable.

## Proposed Changes

### [Component] Core Payment Activities
Remove offline processing, floor limit logic, and local result generation.

#### [MODIFY] [TapToPayActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/TapToPayActivity.kt)
- Remove `floorLimitAED` and `fetchFloorLimit()`.
- Remove `handleOfflineTap()`.
- In `onTagDiscovered()`, call `sendToBackend()` directly without checking for offline mode.
- In `sendToBackend()`, remove the unreachable code in `onFailure` that saves transactions offline and builds `FloorLimitResult`.
- Remove `buildFloorLimitResult()`.
- Remove `offline` parameters from `build1016Sale()` and `sendToBackend()`.

#### [MODIFY] [MotoActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/MotoActivity.kt)
- Remove `isOffline` flag and logic.
- In `btnMotoPay` click listener, remove the `if (isOffline)` block.
- In `sendToBackend()`, remove the unreachable code in `onFailure` that saves transactions offline.
- Remove `showOfflineResult()`.
- Remove `offline` parameters from helper functions.

#### [MODIFY] [CashOutActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/CashOutActivity.kt)
- In `sendCashOutRequest()`, remove the unreachable code in `onFailure` that saves cash-outs offline.

#### [MODIFY] [PaymentMethodActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/PaymentMethodActivity.kt)
- Remove `isOffline` logic and intent extras.
- Update header text to remove `[ONLINE/OFFLINE]` label.

---

### [Component] User Interface
Remove buttons and screens related to offline history and syncing.

#### [MODIFY] [HomeActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/HomeActivity.kt)
- Remove logic for loading pending offline count.
- Remove `btnSyncOffline` and `btnHistory` click listeners and related `sync` logic.

#### [MODIFY] [activity_home.xml](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/res/layout/activity_home.xml)
- Set `btnSyncOffline` and `btnHistory` visibility to `gone` (or remove them).

#### [MODIFY] [SettingsActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/SettingsActivity.kt)
- Remove `btnSyncOffline` logic.

---

### [Component] Data Layer (Cleanup)
Delete classes and database entries that only served the offline/demo transaction features.

#### [DELETE] [OfflineSyncManager.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/OfflineSyncManager.kt)
#### [DELETE] [TransactionHistoryActivity.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/TransactionHistoryActivity.kt)
#### [DELETE] [activity_transaction_history.xml](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/res/layout/activity_transaction_history.xml)
#### [DELETE] [OfflineTransaction.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/data/db/entity/OfflineTransaction.kt)
#### [DELETE] [OfflineDao.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/data/db/dao/OfflineDao.kt)

#### [MODIFY] [AppDatabase.kt](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/src/main/kotlin/com/primestack/taptopay/data/db/AppDatabase.kt)
- Remove `OfflineTransaction` from the `@Database` entity list.
- Remove `offlineDao()` abstract method.

## Verification Plan

### Automated Tests
- Build the project to ensure all references to deleted classes are removed.
- Run the app and verify the "Transactions" and "Sync" buttons are gone.
- Perform a sale and verify it only proceeds online.

### Manual Verification
- Verify that failing a transaction (e.g., turning off Wi-Fi) no longer results in an "Approved Offline" or "Stored Offline" state.
