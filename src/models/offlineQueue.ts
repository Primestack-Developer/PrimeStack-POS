import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
// OfflineQueueModel
// Stores 101.6 messages that could not be sent to the backend
// (terminal was offline). The sync endpoint processes these.
// status: PENDING → SYNCED | FAILED
// ─────────────────────────────────────────────────────────────

const OfflineQueueSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, unique: true },
  payload:        { type: Object, required: true }, // full 101.6 request object
  endpoint:       { type: String, required: true }, // "/1016/transaction" or "/1016/cashout"
  status: {
    type:    String,
    default: "PENDING",
    enum:    ["PENDING", "SYNCED", "FAILED"]
  },
  attempts:   { type: Number, default: 0 },
  last_error: { type: String },
  created_at: { type: Date, default: Date.now },
  synced_at:  { type: Date }
});

export const OfflineQueueModel = mongoose.model("OfflineQueue", OfflineQueueSchema);
