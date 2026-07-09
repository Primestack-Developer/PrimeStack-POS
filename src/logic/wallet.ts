import crypto from "crypto";
import mongoose from "mongoose";
import {
  MerchantWalletModel,
  WalletLedgerModel,
  PayoutRequestModel
} from "../models/wallet.js";

// ─────────────────────────────────────────────────────────────
// ensureWallet
// Creates a wallet for a merchant if one doesn't exist yet.
// Called at merchant registration and lazily on first credit.
// ─────────────────────────────────────────────────────────────
export async function ensureWallet(
  merchant_id: string,
  merchant_name: string,
  currency = "AED"
): Promise<void> {
  await MerchantWalletModel.updateOne(
    { merchant_id },
    {
      $setOnInsert: {
        merchant_id,
        merchant_name,
        currency,
        balance:         0,
        pending_balance: 0,
        total_credited:  0,
        total_debited:   0,
        status:          "ACTIVE",
        created_at:      new Date()
      }
    },
    { upsert: true }
  );
}

// ─────────────────────────────────────────────────────────────
// creditWallet
// Called after a MOTO SALE is APPROVED.
// Atomically increments balance and writes a ledger entry.
// Uses a MongoDB session for atomicity.
// ─────────────────────────────────────────────────────────────
export async function creditWallet(
  merchant_id: string,
  merchant_name: string,
  amount: number,
  currency: string,
  transaction_id: string,
  description: string
): Promise<{ balance_after: number }> {
  // Ensure wallet exists
  await ensureWallet(merchant_id, merchant_name, currency);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Read current balance inside session
    const wallet = await MerchantWalletModel.findOne(
      { merchant_id },
      null,
      { session }
    );

    if (!wallet) throw new Error("Wallet not found after upsert");
    if (wallet.status === "FROZEN" || wallet.status === "SUSPENDED") {
      throw new Error(`Wallet is ${wallet.status} — credit not allowed`);
    }

    const balance_before = wallet.balance;
    const balance_after  = balance_before + amount;

    // Update wallet balance
    await MerchantWalletModel.updateOne(
      { merchant_id },
      {
        $inc: { balance: amount, total_credited: amount },
        $set: { updated_at: new Date() }
      },
      { session }
    );

    // Write immutable ledger entry
    await WalletLedgerModel.create(
      [{
        merchant_id,
        transaction_id: `CREDIT-${transaction_id}`,
        type:           "CREDIT",
        amount,
        currency,
        balance_before,
        balance_after,
        description
      }],
      { session }
    );

    await session.commitTransaction();
    return { balance_after };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────
// debitWallet
// Called when a payout is APPROVED.
// Deducts from balance and writes a DEBIT ledger entry.
// ─────────────────────────────────────────────────────────────
export async function debitWallet(
  merchant_id: string,
  amount: number,
  currency: string,
  payout_id: string,
  description: string
): Promise<{ balance_after: number }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await MerchantWalletModel.findOne(
      { merchant_id },
      null,
      { session }
    );

    if (!wallet) throw new Error("Wallet not found");
    if (wallet.status !== "ACTIVE") {
      throw new Error(`Wallet is ${wallet.status} — debit not allowed`);
    }
    if (wallet.balance < amount) {
      throw new Error(`Insufficient balance: ${wallet.balance} < ${amount}`);
    }

    const balance_before = wallet.balance;
    const balance_after  = balance_before - amount;

    await MerchantWalletModel.updateOne(
      { merchant_id },
      {
        $inc: { balance: -amount, total_debited: amount },
        $set: { updated_at: new Date() }
      },
      { session }
    );

    await WalletLedgerModel.create(
      [{
        merchant_id,
        transaction_id: `DEBIT-${payout_id}`,
        type:           "DEBIT",
        amount,
        currency,
        balance_before,
        balance_after,
        description
      }],
      { session }
    );

    await session.commitTransaction();
    return { balance_after };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────
// reverseCredit
// Called when a REFUND is processed.
// Deducts amount from wallet balance and writes REFUND entry.
// ─────────────────────────────────────────────────────────────
export async function reverseCredit(
  merchant_id: string,
  amount: number,
  currency: string,
  transaction_id: string,
  description: string
): Promise<{ balance_after: number }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await MerchantWalletModel.findOne(
      { merchant_id },
      null,
      { session }
    );

    if (!wallet) throw new Error("Wallet not found");

    const balance_before = wallet.balance;
    const balance_after  = Math.max(0, balance_before - amount); // floor at 0

    await MerchantWalletModel.updateOne(
      { merchant_id },
      {
        $inc: { balance: -(balance_before - balance_after) },
        $set: { updated_at: new Date() }
      },
      { session }
    );

    await WalletLedgerModel.create(
      [{
        merchant_id,
        transaction_id: `REFUND-${transaction_id}`,
        type:           "REFUND",
        amount:         balance_before - balance_after,
        currency,
        balance_before,
        balance_after,
        description
      }],
      { session }
    );

    await session.commitTransaction();
    return { balance_after };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────
// getWallet  —  read wallet + recent ledger
// ─────────────────────────────────────────────────────────────
export async function getWallet(merchant_id: string) {
  const wallet = await MerchantWalletModel.findOne(
    { merchant_id },
    { __v: 0 }
  );
  return wallet;
}

export async function getWalletLedger(merchant_id: string, limit = 50) {
  return WalletLedgerModel.find({ merchant_id })
    .sort({ created_at: -1 })
    .limit(limit);
}

// ─────────────────────────────────────────────────────────────
// requestPayout  —  merchant submits a withdrawal request
// ─────────────────────────────────────────────────────────────
export async function requestPayout(
  merchant_id: string,
  amount: number,
  currency: string,
  bank_account: {
    account_name: string;
    account_number: string;
    bank_name: string;
    iban?: string;
    swift?: string;
  },
  note?: string
): Promise<{ payout_id: string }> {
  // Check balance before creating request
  const wallet = await MerchantWalletModel.findOne({ merchant_id });
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.status !== "ACTIVE") throw new Error(`Wallet is ${wallet.status}`);
  if (wallet.balance < amount) {
    throw new Error(`Insufficient balance: available ${wallet.balance} ${currency}`);
  }

  const payout_id = `PO-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  await PayoutRequestModel.create({
    payout_id,
    merchant_id,
    amount,
    currency,
    bank_account,
    note,
    status: "PENDING"
  });

  return { payout_id };
}

// ─────────────────────────────────────────────────────────────
// approvePayout  —  admin approves, balance is debited
// ─────────────────────────────────────────────────────────────
export async function approvePayout(
  payout_id: string,
  admin_note?: string
): Promise<{ balance_after: number }> {
  const payout = await PayoutRequestModel.findOne({ payout_id });
  if (!payout) throw new Error("Payout request not found");
  if (payout.status !== "PENDING") {
    throw new Error(`Payout is already ${payout.status}`);
  }

  // Debit wallet
  const { balance_after } = await debitWallet(
    payout.merchant_id,
    payout.amount,
    payout.currency,
    payout_id,
    `Payout to ${payout.bank_account?.bank_name} — ${payout.bank_account?.account_number}`
  );

  // Update payout status
  await PayoutRequestModel.updateOne(
    { payout_id },
    {
      status:       "APPROVED",
      admin_note,
      processed_at: new Date()
    }
  );

  return { balance_after };
}

// ─────────────────────────────────────────────────────────────
// completePayout  —  admin marks bank transfer as done
// ─────────────────────────────────────────────────────────────
export async function completePayout(payout_id: string): Promise<void> {
  await PayoutRequestModel.updateOne(
    { payout_id, status: "APPROVED" },
    { status: "COMPLETED", processed_at: new Date() }
  );
}

// ─────────────────────────────────────────────────────────────
// rejectPayout  —  admin rejects, no balance change
// ─────────────────────────────────────────────────────────────
export async function rejectPayout(
  payout_id: string,
  admin_note: string
): Promise<void> {
  await PayoutRequestModel.updateOne(
    { payout_id, status: "PENDING" },
    { status: "REJECTED", admin_note, processed_at: new Date() }
  );
}
