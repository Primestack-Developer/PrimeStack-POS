import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const NMI_API_URL = process.env.NMI_API_URL || "https://secure.nmi.com/api/transact.php";
const NMI_SECURITY_KEY = process.env.NMI_SECURITY_KEY || "";

export interface NMIRequest {
  amount: number;
  currency: string;
  card_number?: string;
  card_expiry?: string; // MMYY
  card_cvv?: string;
  token?: string;
  transaction_id: string;
  merchant_id: string;
  terminal_id: string;
}

export interface NMIResponse {
  response: string; // 1 = Approved, 2 = Declined, 3 = Error
  responsetext: string;
  authcode?: string;
  transactionid?: string;
  avsresponse?: string;
  cvvresponse?: string;
  orderid?: string;
  type?: string;
  response_code?: string;
}

export async function processNMIPayment(request: NMIRequest): Promise<NMIResponse> {
  try {
    const params = new URLSearchParams();
    params.append("security_key", NMI_SECURITY_KEY);
    params.append("type", "sale");
    params.append("amount", request.amount.toFixed(2));
    params.append("currency", request.currency);
    params.append("orderid", request.transaction_id);
    
    if (request.token) {
      params.append("payment_token", request.token);
    } else if (request.card_number && request.card_expiry) {
      params.append("ccnumber", request.card_number);
      params.append("ccexp", request.card_expiry);
      if (request.card_cvv) {
        params.append("cvv", request.card_cvv);
      }
    } else {
      throw new Error("Either token or card details must be provided");
    }

    const response = await axios.post(NMI_API_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000
    });

    const responseData = Object.fromEntries(new URLSearchParams(response.data));
    
    return {
      response: responseData.response || "3",
      responsetext: responseData.responsetext || "Unknown error",
      authcode: responseData.authcode,
      transactionid: responseData.transactionid,
      avsresponse: responseData.avsresponse,
      cvvresponse: responseData.cvvresponse,
      orderid: responseData.orderid,
      type: responseData.type,
      response_code: responseData.response_code
    };
  } catch (error: any) {
    console.error("[NMI] Payment processing failed:", error.message);
    return {
      response: "3",
      responsetext: error.message || "Payment processing failed"
    };
  }
}

export async function refundNMIPayment(transactionId: string, amount: number): Promise<NMIResponse> {
  try {
    const params = new URLSearchParams();
    params.append("security_key", NMI_SECURITY_KEY);
    params.append("type", "refund");
    params.append("amount", amount.toFixed(2));
    params.append("transactionid", transactionId);

    const response = await axios.post(NMI_API_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000
    });

    const responseData = Object.fromEntries(new URLSearchParams(response.data));
    
    return {
      response: responseData.response || "3",
      responsetext: responseData.responsetext || "Unknown error",
      authcode: responseData.authcode,
      transactionid: responseData.transactionid,
      orderid: responseData.orderid,
      type: responseData.type,
      response_code: responseData.response_code
    };
  } catch (error: any) {
    console.error("[NMI] Refund failed:", error.message);
    return {
      response: "3",
      responsetext: error.message || "Refund failed"
    };
  }
}

export async function voidNMIPayment(transactionId: string): Promise<NMIResponse> {
  try {
    const params = new URLSearchParams();
    params.append("security_key", NMI_SECURITY_KEY);
    params.append("type", "void");
    params.append("transactionid", transactionId);

    const response = await axios.post(NMI_API_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000
    });

    const responseData = Object.fromEntries(new URLSearchParams(response.data));
    
    return {
      response: responseData.response || "3",
      responsetext: responseData.responsetext || "Unknown error",
      transactionid: responseData.transactionid,
      orderid: responseData.orderid,
      type: responseData.type,
      response_code: responseData.response_code
    };
  } catch (error: any) {
    console.error("[NMI] Void failed:", error.message);
    return {
      response: "3",
      responsetext: error.message || "Void failed"
    };
  }
}
