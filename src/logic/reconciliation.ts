import { TransactionModel } from "../models/transaction.js";
import { ReconciliationModel } from "../models/reconciliation.js";

interface AcquirerRecord {
  rrn?: string;
  stan?: string;
  transaction_id?: string;
  status: string;
  amount: number;
  currency: string;
}

export async function reconcileBatch(
  merchant_id: string,
  acquirerRecords: AcquirerRecord[],
  startDate?: Date,
  endDate?: Date
) {
  const filter: any = { "merchant.merchant_id": merchant_id };

  if (startDate && endDate) {
    filter.created_at = {
      $gte: startDate.toISOString(),
      $lt: endDate.toISOString()
    };
  }

  const txs = await TransactionModel.find(filter);

  const details = txs.map((tx: any) => {
    const acq = acquirerRecords.find((a) =>
      (a.rrn && a.rrn === tx.result?.rrn) ||
      (a.stan && a.stan === tx.result?.stan) ||
      (a.transaction_id && a.transaction_id === tx.transaction_id)
    );

    if (!acq) {
      return {
        transaction_id: tx.transaction_id,
        rrn: tx.result?.rrn || "",
        stan: tx.result?.stan || "",
        status: tx.result?.status || "UNKNOWN",
        acquirer_status: "MISSING",
        match: false,
        amount_match: false,
        notes: "Transaction not found in acquirer records"
      };
    }

    const statusMatch = acq.status.toUpperCase() === (tx.result?.status?.toUpperCase() || "UNKNOWN");
    const amountMatch = acq.amount === (tx.amount?.value || 0);
    const match = statusMatch && amountMatch;

    return {
      transaction_id: tx.transaction_id,
      rrn: tx.result?.rrn || "",
      stan: tx.result?.stan || "",
      status: tx.result?.status || "UNKNOWN",
      acquirer_status: acq.status,
      match,
      amount_match: amountMatch,
      notes: !match ? "Mismatch detected" : "OK"
    };
  });

  // Check for acquirer records without matching transactions
  for (const acq of acquirerRecords) {
    const matched = details.some((d: any) =>
      d.rrn === acq.rrn || d.stan === acq.stan || d.transaction_id === acq.transaction_id
    );

    if (!matched) {
      details.push({
        transaction_id: acq.transaction_id || "UNKNOWN",
        rrn: acq.rrn || "",
        stan: acq.stan || "",
        status: "MISSING",
        acquirer_status: acq.status,
        match: false,
        amount_match: false,
        notes: "Acquirer record not found in our system"
      });
    }
  }

  const batch = await ReconciliationModel.create({
    batch_id: "REC-" + Date.now() + "-" + merchant_id,
    merchant_id,
    matched: details.filter((d: any) => d.match).length,
    mismatched: details.filter((d: any) => !d.match && d.acquirer_status !== "MISSING" && d.status !== "MISSING").length,
    missing: details.filter((d: any) => d.acquirer_status === "MISSING" || d.status === "MISSING").length,
    details
  });

  return batch;
}
