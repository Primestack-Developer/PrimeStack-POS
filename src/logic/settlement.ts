import { TransactionModel } from "../models/transaction.js";
import { SettlementModel } from "../models/settlement.js";

export async function generateSettlement(
  merchant_id: string,
  period: "daily" | "weekly" | "monthly",
  terminal_id?: string
) {
  let startDate: Date;
  let endDate: Date = new Date();
  const now = new Date();

  if (period === "daily") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startDate = new Date(now.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    throw new Error("Invalid period");
  }

  const filter: any = {
    "merchant.merchant_id": merchant_id,
    created_at: {
      $gte: startDate.toISOString(),
      $lt: endDate.toISOString()
    }
  };

  if (terminal_id) {
    filter["merchant.terminal_id"] = terminal_id;
  }

  const txs = await TransactionModel.find(filter);

  const approved = txs.filter((t: any) => t.result?.status?.toUpperCase() === "APPROVED");
  const declined = txs.filter((t: any) => t.result?.status?.toUpperCase() === "DECLINED");

  const batch = await SettlementModel.create({
    batch_id: "BATCH-" + Date.now() + "-" + merchant_id,
    merchant_id,
    terminal_id,
    date: startDate.toISOString().split("T")[0],
    period,
    totals: {
      approved_count: approved.length,
      approved_amount: approved.reduce((a: number, b: any) => a + (b.amount?.value || 0), 0),
      declined_count: declined.length,
      declined_amount: declined.reduce((a: number, b: any) => a + (b.amount?.value || 0), 0),
      total_count: txs.length,
      total_amount: txs.reduce((a: number, b: any) => a + (b.amount?.value || 0), 0)
    },
    transactions: txs.map((t: any) => t._id as string)
  });

  return batch;
}

export async function generateDailySettlement(merchant_id: string, terminal_id?: string) {
  return generateSettlement(merchant_id, "daily", terminal_id);
}

export async function generateWeeklySettlement(merchant_id: string, terminal_id?: string) {
  return generateSettlement(merchant_id, "weekly", terminal_id);
}

export async function generateMonthlySettlement(merchant_id: string, terminal_id?: string) {
  return generateSettlement(merchant_id, "monthly", terminal_id);
}

export function exportToCSV(settlement: any, transactions: any) {
  const headers = ["Transaction ID", "Status", "Amount", "Currency", "Terminal", "Timestamp"];
  const rows = transactions.map((tx: any) => [
    tx.transaction_id,
    tx.result?.status || "UNKNOWN",
    tx.amount?.value || 0,
    tx.amount?.currency || "",
    tx.merchant?.terminal_id || "",
    tx.timestamp || ""
  ]);

  const csv = [headers, ...rows].map((row: string[]) => row.map((cell) => "\"" + cell + "\"").join(",")).join("\n");
  return csv;
}

export function exportToJSON(settlement: any, transactions: any) {
  return JSON.stringify({ settlement, transactions }, null, 2);
}
