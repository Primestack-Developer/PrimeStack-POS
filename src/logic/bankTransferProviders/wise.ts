import axios from "axios";
import {
  IBankTransferProvider,
  BankTransferRequest,
  BankTransferResponse
} from "./index.js";

// ─────────────────────────────────────────────────────────────
// Wise Payouts API Provider
//
// Flow for every transfer:
//   1. GET  /v1/profiles              → get profileId
//   2. POST /v1/accounts              → create recipient
//   3. POST /v1/quotes                → get quote (exchange rate)
//   4. POST /v1/transfers             → create transfer
//   5. POST /v3/profiles/{id}/transfers/{id}/payments → fund it
// ─────────────────────────────────────────────────────────────

const WISE_BASE = "https://api.wise.com";

export class WiseBankTransferProvider implements IBankTransferProvider {
  name = "Wise";

  private apiKey: string;
  private profileId: string | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
  }

  // Step 1 — get the business profile ID (cached after first call)
  private async getProfileId(): Promise<string> {
    if (this.profileId) return this.profileId;

    const res = await axios.get(`${WISE_BASE}/v1/profiles`, {
      headers: this.headers()
    });

    const profiles: any[] = res.data;
    // Prefer business profile
    const business = profiles.find(p => p.type === "BUSINESS");
    const profile  = business || profiles[0];

    if (!profile) throw new Error("No Wise profile found");
    this.profileId = String(profile.id);
    return this.profileId;
  }

  // Step 2 — create a recipient account
  private async createRecipient(
    profileId: string,
    request: BankTransferRequest
  ): Promise<string> {
    const { bank_account, currency } = request;

    // Build account details — supports IBAN, local account number
    const details: any = {
      legalType: "PRIVATE"
    };

    if (bank_account.iban) {
      details.IBAN = bank_account.iban;
    } else {
      details.accountNumber = bank_account.account_number;
      if (bank_account.swift) details.BIC = bank_account.swift;
    }

    const payload: any = {
      profile:    profileId,
      accountHolderName: bank_account.account_name,
      currency:   currency,
      type:       bank_account.iban ? "iban" : "swift_code",
      details
    };

    const res = await axios.post(
      `${WISE_BASE}/v1/accounts`,
      payload,
      { headers: this.headers() }
    );

    return String(res.data.id);
  }

  // Step 3 — create a quote
  private async createQuote(
    profileId: string,
    amount: number,
    currency: string
  ): Promise<string> {
    const payload = {
      profile:          profileId,
      source:           "USD",    // your Wise balance currency
      target:           currency,
      sourceAmount:     currency === "USD" ? amount : undefined,
      targetAmount:     currency !== "USD" ? amount : undefined,
      rateType:         "FIXED",
      payOut:           "BANK_TRANSFER",
      preferredPayIn:   "BALANCE"
    };

    const res = await axios.post(
      `${WISE_BASE}/v1/quotes`,
      payload,
      { headers: this.headers() }
    );

    return String(res.data.id);
  }

  // Step 4 — create transfer
  private async createTransfer(
    targetAccountId: string,
    quoteId: string,
    referenceCode: string
  ): Promise<string> {
    const payload = {
      targetAccount:       targetAccountId,
      quoteUuid:           quoteId,
      customerTransactionId: referenceCode,
      details: {
        reference: referenceCode
      }
    };

    const res = await axios.post(
      `${WISE_BASE}/v1/transfers`,
      payload,
      { headers: this.headers() }
    );

    return String(res.data.id);
  }

  // Step 5 — fund the transfer from Wise balance
  private async fundTransfer(
    profileId: string,
    transferId: string
  ): Promise<{ status: string; errorCode?: string }> {
    const res = await axios.post(
      `${WISE_BASE}/v3/profiles/${profileId}/transfers/${transferId}/payments`,
      { type: "BALANCE" },
      { headers: this.headers() }
    );

    return {
      status:    res.data.status,
      errorCode: res.data.errorCode
    };
  }

  // ── Main entry point ──────────────────────────────────────
  async initiateTransfer(request: BankTransferRequest): Promise<BankTransferResponse> {
    try {
      console.log(`[Wise] Initiating transfer: ${request.amount} ${request.currency} to ${request.bank_account.account_name}`);

      const profileId = await this.getProfileId();

      const recipientId = await this.createRecipient(profileId, request);
      console.log(`[Wise] Recipient created: ${recipientId}`);

      const quoteId = await this.createQuote(profileId, request.amount, request.currency);
      console.log(`[Wise] Quote created: ${quoteId}`);

      const transferId = await this.createTransfer(
        recipientId,
        quoteId,
        request.request_id
      );
      console.log(`[Wise] Transfer created: ${transferId}`);

      const fundResult = await this.fundTransfer(profileId, transferId);
      console.log(`[Wise] Transfer funded: ${fundResult.status}`);

      if (fundResult.errorCode) {
        return {
          success:     false,
          transfer_id: transferId,
          status:      "FAILED",
          message:     `Wise error: ${fundResult.errorCode}`
        };
      }

      return {
        success:     true,
        transfer_id: transferId,
        status:      fundResult.status === "COMPLETED" ? "COMPLETED" : "PROCESSING",
        message:     `Wise transfer ${transferId} — ${fundResult.status}`,
        meta:        { wise_transfer_id: transferId, wise_profile_id: profileId }
      };

    } catch (err: any) {
      const message = err.response?.data?.message
        || err.response?.data?.[0]?.message
        || err.message
        || "Wise transfer failed";

      console.error(`[Wise] Transfer error:`, message);

      return {
        success: false,
        status:  "FAILED",
        message
      };
    }
  }

  async checkTransferStatus(transfer_id: string): Promise<BankTransferResponse> {
    try {
      const res = await axios.get(
        `${WISE_BASE}/v1/transfers/${transfer_id}`,
        { headers: this.headers() }
      );

      const t = res.data;
      return {
        success:     t.status !== "cancelled" && t.status !== "funds_never_received",
        transfer_id: String(t.id),
        status:      t.status === "outgoing_payment_sent" ? "COMPLETED" : "PROCESSING",
        message:     t.status,
        meta:        t
      };
    } catch (err: any) {
      return {
        success: false,
        status:  "FAILED",
        message: err.message
      };
    }
  }
}
