import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Finix API Configuration
const FINIX_API_URL = process.env.FINIX_API_URL || "https://api.finix.com/v1";
const FINIX_USERNAME = process.env.FINIX_USERNAME || "";
const FINIX_PASSWORD = process.env.FINIX_PASSWORD || "";

// Basic Auth for Finix API
const finixAuth = {
  username: FINIX_USERNAME,
  password: FINIX_PASSWORD
};

export interface FinixPaymentRequest {
  amount: number; // In cents (Finix uses cents)
  currency: string;
  paymentInstrumentId?: string; // For tokenized payments
  cardNumber?: string; // For raw card (not recommended - use tokens)
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardCvv?: string;
  merchantId: string;
  terminalId: string;
  transactionId: string;
}

export interface FinixPaymentResponse {
  success: boolean;
  id?: string; // Finix transfer ID
  status: "SUCCEEDED" | "FAILED" | "PENDING";
  message?: string;
  authCode?: string;
  rrn?: string;
  stan?: string;
}

/**
 * Process a payment with Finix
 */
export async function processFinixPayment(
  request: FinixPaymentRequest
): Promise<FinixPaymentResponse> {
  try {
    // If we don't have Finix credentials, fall back to demo mode
    if (!FINIX_USERNAME || !FINIX_PASSWORD) {
      console.log("[Finix] Credentials not set - using demo mode");
      return {
        success: true,
        id: `FNX-DEMO-${Date.now()}`,
        status: "SUCCEEDED",
        message: "Demo payment successful (Finix not configured)",
        authCode: "DEMO12",
        rrn: "RR" + Date.now().toString().substring(2),
        stan: Math.floor(Math.random() * 900000 + 100000).toString()
      };
    }

    console.log(`[Finix] Processing payment: ${request.transactionId}`);

    // Convert amount to cents (Finix uses smallest currency unit)
    const amountInCents = Math.round(request.amount * 100);

    // Create a transfer in Finix
    // Note: This is a simplified example - in production, use Payment Instruments (tokens)
    const transferData = {
      amount: amountInCents,
      currency: request.currency.toLowerCase(),
      merchant: request.merchantId,
      metadata: {
        terminal_id: request.terminalId,
        transaction_id: request.transactionId
      }
    };

    const response = await axios.post(
      `${FINIX_API_URL}/transfers`,
      transferData,
      { auth: finixAuth }
    );

    console.log(`[Finix] Transfer created: ${response.data.id}`);

    return {
      success: response.data.state === "SUCCEEDED" || response.data.state === "PENDING",
      id: response.data.id,
      status: response.data.state,
      message: `Payment ${response.data.state.toLowerCase()}`,
      authCode: response.data.id.substring(0, 6).toUpperCase(),
      rrn: "RR" + Date.now().toString().substring(2),
      stan: Math.floor(Math.random() * 900000 + 100000).toString()
    };

  } catch (error: any) {
    console.error("[Finix] Payment failed:", error.response?.data || error.message);
    return {
      success: false,
      status: "FAILED",
      message: error.response?.data?.message || error.message || "Payment failed"
    };
  }
}

/**
 * Refund a payment with Finix
 */
export async function refundFinixPayment(
  transferId: string,
  amount: number
): Promise<FinixPaymentResponse> {
  try {
    if (!FINIX_USERNAME || !FINIX_PASSWORD) {
      return {
        success: true,
        id: `FNX-DEMO-REFUND-${Date.now()}`,
        status: "SUCCEEDED",
        message: "Demo refund successful"
      };
    }

    const amountInCents = Math.round(amount * 100);

    const refundData = {
      amount: amountInCents,
      parent: transferId
    };

    const response = await axios.post(
      `${FINIX_API_URL}/transfers`,
      refundData,
      { auth: finixAuth }
    );

    return {
      success: response.data.state === "SUCCEEDED",
      id: response.data.id,
      status: response.data.state,
      message: "Refund processed"
    };

  } catch (error: any) {
    console.error("[Finix] Refund failed:", error.response?.data || error.message);
    return {
      success: false,
      status: "FAILED",
      message: error.response?.data?.message || "Refund failed"
    };
  }
}

/**
 * Void a payment with Finix
 */
export async function voidFinixPayment(
  transferId: string
): Promise<FinixPaymentResponse> {
  try {
    if (!FINIX_USERNAME || !FINIX_PASSWORD) {
      return {
        success: true,
        id: `FNX-DEMO-VOID-${Date.now()}`,
        status: "SUCCEEDED",
        message: "Demo void successful"
      };
    }

    // To void in Finix, you reverse the transfer
    const response = await axios.post(
      `${FINIX_API_URL}/transfers/${transferId}/reversals`,
      {},
      { auth: finixAuth }
    );

    return {
      success: true,
      id: response.data.id,
      status: "SUCCEEDED",
      message: "Payment voided successfully"
    };

  } catch (error: any) {
    console.error("[Finix] Void failed:", error.response?.data || error.message);
    return {
      success: false,
      status: "FAILED",
      message: error.response?.data?.message || "Void failed"
    };
  }
}
