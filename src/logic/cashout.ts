import axios from "axios";
import { ExternalIssuerModel } from "../models/externalIssuer.js";
import {
  ExternalDebitRequest,
  ExternalDebitResponse
} from "../types/cashout.js";

// ─────────────────────────────────────────────────────────────
// callExternalIssuer
// Looks up the registered external server by server_id,
// then POSTs a DEBIT request to their API.
// Returns their response or a structured error.
// ─────────────────────────────────────────────────────────────
export async function callExternalIssuer(
  server_id: string,
  user_id: string,
  amount: number,
  currency: string,
  pos_reference: string,
  pos_terminal_id: string
): Promise<ExternalDebitResponse> {
  // 1. Look up the registered external server
  const issuer = await ExternalIssuerModel.findOne({
    server_id,
    status: "ACTIVE"
  });

  if (!issuer) {
    return {
      approved: false,
      message: "External issuer not found or inactive",
      error_code: "ISSUER_NOT_FOUND"
    };
  }

  // 2. Build the debit payload
  const payload: ExternalDebitRequest = {
    request_type: "DEBIT",
    user_id,
    amount,
    currency,
    pos_reference,
    pos_terminal_id
  };

  // 3. Call their server with their api_key in the Authorization header
  try {
    const response = await axios.post<ExternalDebitResponse>(
      issuer.api_url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${issuer.api_key}`
        },
        timeout: 10000 // 10s timeout — treat timeout as decline, not error
      }
    );

    return response.data;
  } catch (err: any) {
    // Network error or timeout — decline, do not crash
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return {
        approved: false,
        message: "External issuer timeout",
        error_code: "ISSUER_TIMEOUT"
      };
    }

    // Their server returned a non-2xx (e.g. 402 Insufficient Funds)
    if (err.response?.data) {
      return {
        approved: false,
        message: err.response.data.message || "Declined by issuer",
        error_code: err.response.data.error_code || "ISSUER_DECLINED"
      };
    }

    return {
      approved: false,
      message: "External issuer unreachable",
      error_code: "ISSUER_UNREACHABLE"
    };
  }
}
