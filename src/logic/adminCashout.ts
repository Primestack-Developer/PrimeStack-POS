import { STNCodeModel } from "../models/stnCode.js";
import { 
  getDefaultBankTransferProvider, 
  BankTransferRequest,
  BankTransferResponse
} from "./bankTransferProviders/index.js";
import { debitWallet, getWallet } from "./wallet.js";
import crypto from "crypto";

export interface AdminCashoutInitiateRequest {
  admin_id: string;
  amount: number;
  currency: string;
  bank_account: {
    account_name: string;
    account_number: string;
    bank_name: string;
    iban?: string;
    swift?: string;
    country?: string;
  };
}

export interface AdminCashoutInitiateResponse {
  success: boolean;
  stn_id: string;
  message: string;
}

export interface AdminCashoutVerifyRequest {
  stn_code: string;
}

export interface AdminCashoutVerifyResponse {
  success: boolean;
  stn_id: string;
  amount: number;
  currency: string;
  status: string;
  transfer_response?: BankTransferResponse;
}

/**
 * Initiate an admin cashout - generates an STN code
 */
export async function initiateAdminCashout(
  request: AdminCashoutInitiateRequest
): Promise<AdminCashoutInitiateResponse> {
  // First, check if the admin wallet has enough balance
  // Note: We're treating "admin" as a special merchant_id for now
  // You can adjust this based on your actual admin wallet structure
  const adminWallet = await getWallet("admin");
  if (!adminWallet) {
    throw new Error("Admin wallet not found");
  }
  if (adminWallet.balance < request.amount) {
    throw new Error(`Insufficient balance: Available ${adminWallet.balance} ${request.currency}, Requested ${request.amount}`);
  }

  // Generate STN code
  const stnCode = new STNCodeModel({
    admin_id: request.admin_id,
    amount: request.amount,
    currency: request.currency,
    bank_account: request.bank_account
  });
  await stnCode.save();

  console.log(`[AdminCashout] STN code generated: ${stnCode.code} (expires in 15 minutes)`);

  return {
    success: true,
    stn_id: stnCode.stn_id,
    message: "STN code generated successfully - valid for 15 minutes"
  };
}

/**
 * Verify STN code and process the actual bank transfer
 */
export async function verifyAndProcessAdminCashout(
  request: AdminCashoutVerifyRequest
): Promise<AdminCashoutVerifyResponse> {
  // Verify STN code
  const stnCode = await STNCodeModel.findOne({
    code: request.stn_code,
    status: "PENDING",
    expires_at: { $gt: new Date() }
  });

  if (!stnCode) {
    throw new Error("Invalid or expired STN code");
  }

  // Update STN status to VERIFIED first
  stnCode.status = "VERIFIED";
  await stnCode.save();

  // Now, process the actual bank transfer
  const transferProvider = getDefaultBankTransferProvider();
  
  const transferRequest: BankTransferRequest = {
    request_id: stnCode.stn_id,
    amount: stnCode.amount,
    currency: stnCode.currency,
    bank_account: stnCode.bank_account,
    description: `Admin cashout - STN: ${stnCode.stn_id}`
  };

  const transferResponse = await transferProvider.initiateTransfer(transferRequest);

  if (transferResponse.success) {
    // If transfer is successful, debit the admin wallet
    await debitWallet(
      "admin",
      stnCode.amount,
      stnCode.currency,
      stnCode.stn_id,
      `Admin cashout to ${stnCode.bank_account.bank_name} - ${stnCode.bank_account.account_number}`
    );

    // Mark STN as used
    stnCode.status = "USED";
    stnCode.used_at = new Date();
    await stnCode.save();

    return {
      success: true,
      stn_id: stnCode.stn_id,
      amount: stnCode.amount,
      currency: stnCode.currency,
      status: "COMPLETED",
      transfer_response: transferResponse
    };
  } else {
    // If transfer failed, mark STN as expired
    stnCode.status = "EXPIRED";
    await stnCode.save();

    return {
      success: false,
      stn_id: stnCode.stn_id,
      amount: stnCode.amount,
      currency: stnCode.currency,
      status: "FAILED",
      transfer_response: transferResponse
    };
  }
}

/**
 * Get STN code details (for admin dashboard)
 */
export async function getSTNDetails(stn_id: string) {
  return await STNCodeModel.findOne({ stn_id });
}

/**
 * Get all STN codes for admin
 */
export async function getAdminSTNCodes(admin_id: string) {
  return await STNCodeModel.find({ admin_id }).sort({ created_at: -1 });
}
