import { TransactionModel } from "../models/transaction.js";

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
  riskScore?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
}

const RISKY_BINS = ["999999", "888888", "777777"];
const RISKY_MCCS = ["5967", "5912", "7995"]; // High-risk MCC codes
const MAX_VELOCITY = 5; // transactions per minute
const MAX_DECLINE_VELOCITY = 3; // declines per hour

export async function fraudCheck(msg: any): Promise<FraudCheckResult> {
  let riskScore = 0;

  // 1. Velocity check - too many transactions from same card in short time
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const recentTx = await TransactionModel.find({
    $and: [
      { "card.last4": msg.card?.last4 },
      { timestamp: { $gte: oneMinuteAgo.toISOString() } }
    ]
  });

  if (recentTx.length > MAX_VELOCITY) {
    return {
      blocked: true,
      reason: "Velocity limit exceeded",
      riskScore: 100,
      riskLevel: "HIGH"
    };
  }

  if (recentTx.length > 2) {
    riskScore += 30;
  }

  // 2. Decline velocity - too many recent declines
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentDeclines = await TransactionModel.find({
    $and: [
      { "card.last4": msg.card?.last4 },
      { "result.status": "DECLINED" },
      { timestamp: { $gte: oneHourAgo.toISOString() } }
    ]
  });

  if (recentDeclines.length > MAX_DECLINE_VELOCITY) {
    return {
      blocked: true,
      reason: "Too many recent declines",
      riskScore: 90,
      riskLevel: "HIGH"
    };
  }

  // 3. High-risk BIN check
  const token = msg.card?.token || "";
  const cardBin = token.substring(0, 6);
  if (RISKY_BINS.includes(cardBin)) {
    return {
      blocked: true,
      reason: "High-risk BIN detected",
      riskScore: 100,
      riskLevel: "HIGH"
    };
  }

  // 4. High-risk MCC check
  if (msg.metadata?.mcc && RISKY_MCCS.includes(msg.metadata.mcc)) {
    riskScore += 40;
  }

  // 5. Amount anomaly check - unusually large amount
  const avgAmount = await getAverageTransactionAmount(msg.merchant?.merchant_id);
  if (msg.amount?.value > avgAmount * 5) {
    riskScore += 25;
  }

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (riskScore >= 70) riskLevel = "HIGH";
  else if (riskScore >= 40) riskLevel = "MEDIUM";

  if (riskLevel === "HIGH") {
    return {
      blocked: true,
      reason: "High risk transaction detected",
      riskScore,
      riskLevel
    };
  }

  return {
    blocked: false,
    riskScore,
    riskLevel
  };
}

async function getAverageTransactionAmount(merchant_id: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const txs = await TransactionModel.find({
    "merchant.merchant_id": merchant_id,
    timestamp: { $gte: thirtyDaysAgo.toISOString() }
  });

  if (txs.length === 0) return 100; // Default average

  const total = txs.reduce((sum: number, tx: any) => sum + (tx.amount?.value || 0), 0);
  return total / txs.length;
}
