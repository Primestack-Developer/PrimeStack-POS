export interface BankTransferRequest {
  request_id: string;
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
  description?: string;
  meta?: any;
}

export interface BankTransferResponse {
  success: boolean;
  transfer_id?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  message?: string;
  meta?: any;
}

export interface IBankTransferProvider {
  name: string;
  isEnabled(): boolean;
  initiateTransfer(request: BankTransferRequest): Promise<BankTransferResponse>;
  checkTransferStatus(transfer_id: string): Promise<BankTransferResponse>;
}

// Demo provider - just simulates the transfer
export class DemoBankTransferProvider implements IBankTransferProvider {
  name = "DemoBankTransferProvider";
  
  isEnabled(): boolean {
    return true; // Always enabled for demo
  }
  
  async initiateTransfer(request: BankTransferRequest): Promise<BankTransferResponse> {
    console.log(`[DemoBankTransferProvider] Initiating transfer:`, request);
    
    // Simulate a successful transfer after a short delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      transfer_id: `DEMO-TX-${Date.now()}`,
      status: "COMPLETED",
      message: "Demo transfer completed successfully (no real money moved)",
      meta: { demo: true, request }
    };
  }
  
  async checkTransferStatus(transfer_id: string): Promise<BankTransferResponse> {
    return {
      success: true,
      transfer_id,
      status: "COMPLETED",
      message: "Demo transfer status checked"
    };
  }
}

// You can add more providers here:
// - StripeTransferProvider
// - PlaidTransferProvider
// - DwollaTransferProvider
// - LocalBankAPITransferProvider

export const bankTransferProviders = {
  demo: new DemoBankTransferProvider()
  // Add more providers here as needed
};

export const getDefaultBankTransferProvider = (): IBankTransferProvider => {
  // You can make this configurable via environment variable later
  return bankTransferProviders.demo;
};
