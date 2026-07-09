import { Protocol1016Request } from "../types/1016.js";
import { CashOutRequest } from "../types/cashout.js";
import { OfflineQueueModel } from "../models/offlineQueue.js";

// ─────────────────────────────────────────────────────────────
// storeOffline
// Called by the 101.6 transaction handler when
// transaction_flags.offline = true — persists to MongoDB
// instead of an in-memory array.
// ─────────────────────────────────────────────────────────────
export async function storeOffline(
  msg: Protocol1016Request | CashOutRequest
): Promise<void> {
  const endpoint = msg.message_type === "CASH_OUT"
    ? "/1016/cashout"
    : "/1016/transaction";

  try {
    await OfflineQueueModel.create({
      transaction_id: msg.transaction_id,
      payload:        msg,
      endpoint
    });
    console.log(`[OfflineQueue] Stored: ${msg.transaction_id}`);
  } catch (err: any) {
    // Duplicate transaction_id — already queued, ignore
    if (err?.code === 11000) return;
    console.error(`[OfflineQueue] Failed to store ${msg.transaction_id}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// getPendingCount
// Used by the health check endpoint so operators can see
// how many transactions are waiting.
// ─────────────────────────────────────────────────────────────
export async function getPendingCount(): Promise<number> {
  return OfflineQueueModel.countDocuments({ status: "PENDING" });
}

// ─────────────────────────────────────────────────────────────
// getPending / markSynced / markFailed
// Used by the /offline/sync endpoint in index.ts
// ─────────────────────────────────────────────────────────────
export async function getPending(limit = 100) {
  return OfflineQueueModel.find({ status: "PENDING" })
    .sort({ created_at: 1 })
    .limit(limit);
}

export async function markSynced(transaction_id: string): Promise<void> {
  await OfflineQueueModel.updateOne(
    { transaction_id },
    { status: "SYNCED", synced_at: new Date() }
  );
}

export async function markFailed(transaction_id: string, error: string): Promise<void> {
  await OfflineQueueModel.updateOne(
    { transaction_id },
    { $set: { status: "FAILED", last_error: error }, $inc: { attempts: 1 } }
  );
}
