import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Protocol1016Request, Protocol1016Response } from './types/1016.js';
import { CashOutRequest, CashOutResponse } from './types/cashout.js';
import { verifyMessage, signMessage } from './security/hmac.js';
import { MerchantModel } from './models/merchant.js';
import { TransactionModel } from './models/transaction.js';
import { ExternalIssuerModel } from './models/externalIssuer.js';
import { CashOutTransactionModel } from './models/cashoutTransaction.js';
import { connectMongo } from './db/mongo.js';
import { 
  generateDailySettlement, 
  generateWeeklySettlement, 
  generateMonthlySettlement,
  exportToCSV,
  exportToJSON
} from './logic/settlement.js';
import { reconcileBatch } from './logic/reconciliation.js';
import { SettlementModel } from './models/settlement.js';
import { ReconciliationModel } from './models/reconciliation.js';
import { fraudCheck } from './logic/fraud.js';
import { sendFraudAlert, sendSettlementAlert } from './utils/alerts.js';
import { lookupBin } from './logic/binLookup.js';
import { ChargebackModel } from './models/chargeback.js';
import { convert } from './logic/currency.js';
import { routeToAcquirer } from "./logic/router.js";
import { processNMIPayment, refundNMIPayment, voidNMIPayment, NMIResponse } from "./logic/acquirers/nmi.js";
import { processFinixPayment, refundFinixPayment, voidFinixPayment, FinixPaymentResponse } from "./logic/acquirers/finix.js";
import { 
  initiateAdminCashout,
  verifyAndProcessAdminCashout,
  getSTNDetails,
  getAdminSTNCodes
} from "./logic/adminCashout.js";
import { generateReceiptCode } from "./logic/receiptCode.js";
import { generateSTN, verifySTN, markSTNUsed } from "./logic/stnReceipt.js";
import { chargeCardWithStripe, isStripeEnabled } from "./logic/stripePayment.js";
import { handleStripeWebhook } from "./webhooks/stripeWebhook.js";
import { handleWiseWebhook } from "./webhooks/wiseWebhook.js";
import { VaultModel } from './models/vault.js';
import { encryptPAN } from './security/vault.js';
import { riskScore } from './logic/risk.js';
import { WebhookModel } from './models/webhook.js';
import { sendWebhook } from './utils/webhook.js';
import { callExternalIssuer } from './logic/cashout.js';
import {
  createOfflineWalletRecord,
  syncOfflineWalletDebit,
  voidOfflineWalletDebit,
  getWalletState
} from './logic/offlineWallet.js';
import {
  storeOffline,
  getPending,
  getPendingCount,
  markSynced,
  markFailed
} from './pos/offlineQueue.js';
import {
  ensureWallet,
  creditWallet,
  reverseCredit,
  debitWallet,
  getWallet,
  getWalletLedger,
  requestPayout,
  approvePayout,
  completePayout,
  rejectPayout
} from './logic/wallet.js';
import { MerchantWalletModel, PayoutRequestModel } from './models/wallet.js';
import {
  AdminUserModel,
  hashPassword,
  verifyPassword,
  hashPrivateKey,
  seedAdminUser
} from './models/adminUser.js';
import { generateToken, requireAuth } from './middleware/auth.js';

dotenv.config();

// Connect to MongoDB
connectMongo().then(() => seedAdminUser());

const app = express();
const PORT = process.env.PORT || 4000;

async function getTerminalSecret(terminal_id: string): Promise<string> {
  const merchant = await MerchantModel.findOne({ "terminals.terminal_id": terminal_id, "terminals.status": "ACTIVE" });
  if (merchant) {
    const terminal = merchant.terminals.find(t => t.terminal_id === terminal_id && t.status === "ACTIVE");
    if (terminal && terminal.secret_key) {
      return terminal.secret_key;
    }
  }
  return process.env.TERMINAL_SECRET_KEY || "default_key";
}

app.use(cors({
  origin: [
    'https://primestack-dashboard.onrender.com',
    'http://localhost:3001',
    'http://localhost:3000'
  ],
  credentials: true
}));

// ── Stripe webhook — MUST use raw body before express.json() ──
// Stripe requires the raw request body to verify the signature
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// ── Wise webhook — JSON body ──────────────────────────────────
app.post('/webhooks/wise', express.json(), handleWiseWebhook);

app.use(express.json());

// ─────────────────────────────────────────────────────────────
// Auth endpoints — public (no token required)
// ─────────────────────────────────────────────────────────────

// Login with email + password
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const admin = await AdminUserModel.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await AdminUserModel.updateOne({ email: email.toLowerCase() }, { last_login: new Date() });

    const token = generateToken(admin.email);
    res.json({ token, email: admin.email });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Recover access using private key (resets password)
app.post('/auth/recover', async (req, res) => {
  try {
    const { private_key, new_password } = req.body;
    if (!private_key || !new_password) {
      return res.status(400).json({ error: "private_key and new_password required" });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const keyHash = hashPrivateKey(private_key);
    const admin   = await AdminUserModel.findOne({ private_key_hash: keyHash });

    if (!admin) {
      return res.status(401).json({ error: "Invalid private key" });
    }

    const newHash = await hashPassword(new_password);
    await AdminUserModel.updateOne(
      { private_key_hash: keyHash },
      { password_hash: newHash }
    );

    const token = generateToken(admin.email);
    res.json({ message: "Password reset successful", token, email: admin.email });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Verify token is still valid
app.get('/auth/verify', requireAuth, (req, res) => {
  res.json({ valid: true, admin: (req as any).admin });
});

// Health check — always public
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'PrimeStack 101.6 Host' });
});

// ─────────────────────────────────────────────────────────────
// Global auth middleware
// Protects all routes EXCEPT: /health, /auth/*, /1016/*
// POS terminals use HMAC — they do not use JWT
// Dashboard uses JWT Bearer token
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const open = [
    '/health',
    '/auth/login',
    '/auth/recover',
    '/auth/verify',
    '/webhooks/stripe',
    '/webhooks/wise'
  ];

  // POS transaction endpoints — authenticated via HMAC, not JWT
  if (req.path.startsWith('/1016/') || req.path.startsWith('/merchant/register')) {
    return next();
  }

  // POS wallet balance — Android app reads merchant wallet, no JWT needed
  // The merchant_id in the path is validated against registered merchants
  if (req.method === 'GET' && req.path.startsWith('/wallet/') && !req.path.includes('/ledger') && !req.path.includes('/payouts') && !req.path.includes('/payout')) {
    return next();
  }

  // Wallet balance read — POS app reads its own merchant wallet by merchant_id
  // No JWT needed — merchant_id is not secret, balance is read-only
  if (req.method === 'GET' && req.path.startsWith('/wallet/') && !req.path.includes('/ledger') && !req.path.includes('/payouts')) {
    return next();
  }

  // Public paths
  if (open.includes(req.path)) {
    return next();
  }

  // Everything else requires JWT
  return requireAuth(req, res, next);
});

// Merchant registration endpoint
app.post('/merchant/register', async (req, res) => {
  const { merchant_id, name, country, currency } = req.body;

  if (!merchant_id || !name || !country || !currency) {
    return res.status(400).json({ status: 'ERROR', message: 'Missing required fields' });
  }

  const existingMerchant = await MerchantModel.findOne({ merchant_id });
  if (existingMerchant) {
    return res.status(409).json({ status: 'ERROR', message: 'Merchant already exists' });
  }

  const merchant = await MerchantModel.create({
    merchant_id,
    name,
    country,
    currency,
    terminals: []
  });

  // Auto-create a wallet for this merchant
  await ensureWallet(merchant_id, name, currency);

  res.json({
    status: 'SUCCESS',
    merchant_id,
    message: 'Merchant registered successfully'
  });
});

// Terminal registration endpoint
app.post('/merchant/register-terminal', async (req, res) => {
  const { merchant_id, terminal_id } = req.body;

  if (!merchant_id || !terminal_id) {
    return res.status(400).json({ status: 'ERROR', message: 'Missing required fields' });
  }

  const merchant = await MerchantModel.findOne({ merchant_id });
  if (!merchant) {
    return res.status(404).json({ status: 'ERROR', message: 'Merchant not found' });
  }

  const existingTerminal = merchant.terminals.find(t => t.terminal_id === terminal_id);
  if (existingTerminal) {
    // Terminal already exists — return existing secret key so app can re-register
    return res.json({
      status:     'SUCCESS',
      terminal_id,
      secret_key: existingTerminal.secret_key,
      message:    'Terminal already registered — credentials returned'
    });
  }

  const secret = crypto.randomBytes(32).toString('hex');

  merchant.terminals.push({
    terminal_id,
    secret_key: secret,
    status: "ACTIVE"
  });

  await merchant.save();

  res.json({
    status: 'SUCCESS',
    terminal_id,
    secret_key: secret
  });
});

// Dashboard endpoints
app.get('/transactions', async (req, res) => {
  const { merchant_id, terminal_id } = req.query;
  let filter: any = {};
  
  if (merchant_id) filter["merchant.merchant_id"] = merchant_id;
  if (terminal_id) filter["merchant.terminal_id"] = terminal_id;
  
  const transactions = await TransactionModel.find(filter).sort({ created_at: -1 });
  res.json(transactions);
});

app.get('/transactions/:id', async (req, res) => {
  const transaction = await TransactionModel.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }
  res.json(transaction);
});

app.get('/merchants', async (req, res) => {
  const merchants = await MerchantModel.find();
  res.json(merchants);
});

app.get('/merchants/:id', async (req, res) => {
  const merchant = await MerchantModel.findById(req.params.id);
  if (!merchant) {
    return res.status(404).json({ error: "Merchant not found" });
  }
  res.json(merchant);
});

app.get('/merchants/:merchant_id/terminals', async (req, res) => {
  const merchant = await MerchantModel.findOne({ merchant_id: req.params.merchant_id });
  if (!merchant) {
    return res.status(404).json({ error: "Merchant not found" });
  }
  res.json(merchant.terminals);
});

// Delete a merchant
app.delete('/merchants/:merchant_id', async (req, res) => {
  try {
    const result = await MerchantModel.deleteOne({ merchant_id: req.params.merchant_id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    // Also delete the wallet
    await MerchantWalletModel.deleteOne({ merchant_id: req.params.merchant_id });
    res.json({ status: 'SUCCESS', message: 'Merchant deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete a specific terminal from a merchant
app.delete('/merchants/:merchant_id/terminals/:terminal_id', async (req, res) => {
  try {
    const result = await MerchantModel.updateOne(
      { merchant_id: req.params.merchant_id },
      { $pull: { terminals: { terminal_id: req.params.terminal_id } } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    res.json({ status: 'SUCCESS', message: 'Terminal deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Chargeback API
app.post('/chargeback/create', async (req, res) => {
  try {
    const { transaction_id, merchant_id, reason_code, description } = req.body;

    const caseData = await ChargebackModel.create({
      case_id: `CB-${Date.now()}`,
      transaction_id,
      merchant_id,
      reason_code,
      description,
      status: "OPEN"
    });

    res.json({ status: "SUCCESS", case: caseData });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/chargeback/:merchant_id', async (req, res) => {
  try {
    const chargebacks = await ChargebackModel.find({ merchant_id: req.params.merchant_id }).sort({ created_at: -1 });
    res.json(chargebacks);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Webhook API
app.post('/webhook/register', async (req, res) => {
  try {
    const { merchant_id, url } = req.body;
    const webhook = await WebhookModel.create({ merchant_id, url });
    res.json({ status: "SUCCESS", webhook });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/webhook/:merchant_id', async (req, res) => {
  try {
    const webhook = await WebhookModel.findOne({ merchant_id: req.params.merchant_id });
    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 101.6 transaction endpoint
app.post('/1016/transaction', async (req, res) => {
  const msg = req.body as Protocol1016Request;

  // 1. Verify protocol
  if (msg.protocol !== "101.6") {
    return res.status(400).json({ error: "Invalid protocol" });
  }

  // 2. Get terminal secret
  const terminalSecret = await getTerminalSecret(msg.merchant.terminal_id);

  // 3. Verify HMAC signature
  const valid = verifyMessage(
    { ...msg, security: undefined },
    terminalSecret,
    msg.security.signature
  );

  if (!valid) {
    return res.status(401).json({ error: "Invalid HMAC signature" });
  }

  // 3.5. If the terminal was offline when the transaction was created,
  //      store it in the persistent offline queue and return an OFFLINE_STORED response.
  //      The /offline/sync endpoint will re-process these when the terminal comes back online.
  if (msg.transaction_flags?.offline === true) {
    await storeOffline(msg);
    return res.json({
      protocol:       "101.6",
      message_type:   `${msg.message_type}_RESPONSE`,
      transaction_id: msg.transaction_id,
      timestamp:      new Date().toISOString(),
      result: {
        status:      "PENDING",
        code:        "OF",
        description: "Stored in offline queue — will be processed on next sync"
      }
    });
  }

  // 4. Fraud check
  const fraud = await fraudCheck(msg);
  
  if (fraud.blocked) {
    // Send fraud alert
    sendFraudAlert({
      merchant_id: msg.merchant.merchant_id,
      transaction_id: msg.transaction_id,
      reason: fraud.reason,
      riskScore: fraud.riskScore
    });

    // Decline transaction due to fraud
    const declineResponse: Protocol1016Response = {
      protocol: "101.6",
      message_type: `${msg.message_type}_RESPONSE`,
      transaction_id: msg.transaction_id,
      timestamp: new Date().toISOString(),
      result: {
        status: "DECLINED",
        code: "F1",
        description: fraud.reason || "Fraud detected"
      }
    };
    
    declineResponse.security = {
      nonce: msg.security.nonce,
      signature: signMessage({ ...declineResponse, security: undefined }, terminalSecret),
      algorithm: "HMAC_SHA256"
    };

    // Save declined transaction
    await TransactionModel.create({
      ...msg,
      result: declineResponse.result,
      flags: { offline_stored: false, reversal_required: false },
      security: declineResponse.security
    });

    return res.json(declineResponse);
  }

  // 4.5. Risk score check
  const score = riskScore(msg);
  if (score > 60) {
    const declineResponse: Protocol1016Response = {
      protocol: "101.6",
      message_type: `${msg.message_type}_RESPONSE`,
      transaction_id: msg.transaction_id,
      timestamp: new Date().toISOString(),
      result: {
        status: "DECLINED",
        code: "R1",
        description: "High risk score"
      }
    };

    declineResponse.security = {
      nonce: msg.security.nonce,
      signature: signMessage({ ...declineResponse, security: undefined }, terminalSecret),
      algorithm: "HMAC_SHA256"
    };

    await TransactionModel.create({
      ...msg,
      result: declineResponse.result,
      flags: { offline_stored: false, reversal_required: false },
      security: declineResponse.security
    });

    return res.json(declineResponse);
  }

  // 5. Multi‑currency conversion (normalize to AED)
  if (msg.amount.currency !== "AED") {
    const converted = convert(msg.amount.value, msg.amount.currency, "AED");
    msg.amount.value = converted || msg.amount.value;
    msg.amount.currency = "AED";
  }

  // 5.5. Tokenize PAN for MOTO transactions (PCI compliance)
  // Save raw PAN before tokenization — needed for Stripe charge
  const rawPanForCharge = msg.card.pan || null;

  if (msg.card.entry_mode === "MOTO" && msg.card.pan) {
    const encrypted = encryptPAN(msg.card.pan);

    const token = "TKN-" + crypto.randomBytes(8).toString("hex");

    await VaultModel.create({
      token,
      encrypted_pan: encrypted,
      expiry_month: msg.card.expiry_month,
      expiry_year: msg.card.expiry_year
    });

    msg.card.token = token;
    delete (msg.card as any).pan; // Remove PAN from transaction record
  }

  // 6. BIN Lookup + Card Scheme Detection
  const binInfo = lookupBin(msg.card.token || msg.card.pan || "");
  
  // 7. Acquirer Routing
  const acquirer = routeToAcquirer(msg);

  // 8. Handle message types: SALE, REFUND, VOID, PREAUTH, CAPTURE
  let responseStatus: "APPROVED" | "DECLINED" | "ERROR" | "PENDING" = "PENDING";
  let responseCode = "99";
  let responseDescription = "Signature OK — ready for processing";
  let acquirerAuthCode: string | undefined;
  let acquirerTransactionId: string | undefined;
  let acquirerResponse: NMIResponse | null = null;

  switch (msg.message_type) {
    case "REFUND":
      const original = await TransactionModel.findOne({ transaction_id: msg.transaction_id });
      if (!original) {
        responseStatus = "ERROR";
        responseCode = "404";
        responseDescription = "Original transaction not found";
      } else {
        if (original.result) {
          original.result.status = "REFUNDED";
          await original.save();
        }
        responseStatus = "APPROVED";
        responseCode = "00";
        responseDescription = "Refund approved";
      }
      break;
    
    case "VOID":
      const originalVoid = await TransactionModel.findOne({ transaction_id: msg.transaction_id });
      if (!originalVoid) {
        responseStatus = "ERROR";
        responseCode = "404";
        responseDescription = "Original transaction not found";
      } else {
        if (originalVoid.result) {
          originalVoid.result.status = "VOIDED";
          await originalVoid.save();
        }
        responseStatus = "APPROVED";
        responseCode = "00";
        responseDescription = "Void approved";
      }
      break;

    case "PREAUTH":
      // PREAUTH also charges via Stripe — holds the amount on the card
      if (isStripeEnabled() && rawPanForCharge) {
        const stripeResult = await chargeCardWithStripe({
          amount:         msg.amount.value,
          currency:       msg.amount.currency,
          pan:            rawPanForCharge,
          expiry_month:   msg.card.expiry_month || "",
          expiry_year:    msg.card.expiry_year  || "",
          description:    `PrimeStack PREAUTH — ${msg.merchant.merchant_id}`,
          transaction_id: msg.transaction_id
        });
        if (stripeResult.success) {
          responseStatus        = "APPROVED";
          responseCode          = "00";
          responseDescription   = "Preauth approved";
          acquirerAuthCode      = stripeResult.charge_id;
          acquirerTransactionId = stripeResult.charge_id;
        } else {
          responseStatus      = "DECLINED";
          responseCode        = "05";
          responseDescription = stripeResult.error || "Declined";
        }
      } else {
        responseStatus      = "APPROVED";
        responseCode        = "00";
        responseDescription = "Preauth approved";
      }
      break;

    case "CAPTURE":
      responseStatus = "APPROVED";
      responseCode = "00";
      responseDescription = "Capture approved";
      break;

    case "SALE":
      // Call real acquirer based on routing
      if (acquirer === "NMI" && process.env.NMI_SECURITY_KEY) {
        acquirerResponse = await processNMIPayment({
          amount: msg.amount.value,
          currency: msg.amount.currency,
          token: msg.card.token,
          transaction_id: msg.transaction_id,
          merchant_id: msg.merchant.merchant_id,
          terminal_id: msg.merchant.terminal_id
        });
        
        if (acquirerResponse.response === "1") {
          responseStatus = "APPROVED";
          responseCode = "00";
          responseDescription = acquirerResponse.responsetext || "Approved";
          acquirerAuthCode = acquirerResponse.authcode;
          acquirerTransactionId = acquirerResponse.transactionid;
        } else {
          responseStatus = "DECLINED";
          responseCode = acquirerResponse.response_code || "05";
          responseDescription = acquirerResponse.responsetext || "Declined";
        }
      } else if (acquirer === "FINIX") {
        const finixResponse = await processFinixPayment({
          amount: msg.amount.value,
          currency: msg.amount.currency,
          merchantId: msg.merchant.merchant_id,
          terminalId: msg.merchant.terminal_id,
          transactionId: msg.transaction_id,
          paymentInstrumentId: msg.card.token // Use token if available
        });
        
        if (finixResponse.success) {
          responseStatus = "APPROVED";
          responseCode = "00";
          responseDescription = finixResponse.message || "Approved";
          acquirerAuthCode = finixResponse.authCode;
          acquirerTransactionId = finixResponse.id;
        } else {
          responseStatus = "DECLINED";
          responseCode = "05";
          responseDescription = finixResponse.message || "Declined";
        }
      } else {
        // Stripe — charge real card when PAN is available (MOTO)
        if (isStripeEnabled() && rawPanForCharge) {
          const stripeResult = await chargeCardWithStripe({
            amount:         msg.amount.value,
            currency:       msg.amount.currency,
            pan:            rawPanForCharge,
            expiry_month:   msg.card.expiry_month || "",
            expiry_year:    msg.card.expiry_year  || "",
            description:    `PrimeStack MOTO — ${msg.merchant.merchant_id}`,
            transaction_id: msg.transaction_id
          });

          if (stripeResult.success) {
            responseStatus        = "APPROVED";
            responseCode          = "00";
            responseDescription   = "Approved";
            acquirerAuthCode      = stripeResult.charge_id;
            acquirerTransactionId = stripeResult.charge_id;
          } else {
            responseStatus      = "DECLINED";
            responseCode        = "05";
            responseDescription = stripeResult.error || "Declined by card issuer";
          }
        } else {
          // No acquirer configured — or no PAN (NFC/token-based)
          responseStatus      = "APPROVED";
          responseCode        = "00";
          responseDescription = "Approved";
        }
      }
      break;

    case "PING":
    default:
      responseStatus = "APPROVED";
      responseCode = "00";
      responseDescription = "Approved";
      break;
  }

  // 9. Generate receipt code and STN code for customer
  const receipt_code = generateReceiptCode();
  const stn_code     = generateSTN(); // 6-digit code printed on receipt

  // 10. Build response
  const response: Protocol1016Response = {
    protocol: "101.6",
    message_type: `${msg.message_type}_RESPONSE`,
    transaction_id: msg.transaction_id,
    timestamp: new Date().toISOString(),
    result: {
      status: responseStatus,
      code: responseCode,
      description: responseDescription,
      auth_code: acquirerAuthCode || crypto.randomBytes(6).toString("hex").toUpperCase(),
      rrn: "RR" + Date.now().toString().substring(2),
      stan: crypto.randomBytes(3).toString("hex").toUpperCase()
    },
    amount: msg.amount,
    merchant: msg.merchant,
    card: {
      scheme: binInfo?.scheme || "UNKNOWN",
      last4: msg.card.last4,
      token: msg.card.token
    },
    flags: {
      offline_stored: msg.transaction_flags.offline,
      reversal_required: false
    },
    metadata: {
      ...msg.metadata,
      receipt_code,
      stn_code   // 6-digit code for merchant receipt — used for payout verification
    }
  };

  // 11. Sign response
  response.security = {
    nonce: msg.security.nonce,
    signature: signMessage({ ...response, security: undefined }, terminalSecret),
    algorithm: "HMAC_SHA256"
  };

  // 12. Save transaction to DB
  await TransactionModel.create({
    ...msg,
    result: response.result,
    card: {
      ...msg.card,
      scheme: binInfo?.scheme || "UNKNOWN",
      type: binInfo?.type || "UNKNOWN",
      country: binInfo?.country || ""
    },
    metadata: { 
      ...msg.metadata, 
      receipt_code,
      stn_code,
      acquirer,
      acquirer_transaction_id: acquirerTransactionId
    },
    flags: response.flags,
    security: response.security
  });

  // 12.5. Credit merchant wallet on SALE APPROVED
  if (responseStatus === "APPROVED" && msg.message_type === "SALE") {
    try {
      const mName = (await MerchantModel.findOne({
        merchant_id: msg.merchant.merchant_id
      }))?.name || msg.merchant.merchant_id;

      // If it's the admin wallet, credit admin, else credit merchant
      const walletMerchantId = msg.merchant.merchant_id === "admin" ? "admin" : msg.merchant.merchant_id;
      
      await creditWallet(
        walletMerchantId,
        mName,
        msg.amount.value,
        msg.amount.currency,
        msg.transaction_id,
        `Sale — ${msg.card.entry_mode} — terminal ${msg.merchant.terminal_id}`
      );
    } catch (walletErr: any) {
      // Wallet credit failed — log it but do not reverse the approved transaction
      console.error(`[Wallet] Credit failed for ${msg.transaction_id}:`, walletErr.message);
    }
  }

  // 12.6. Reverse merchant wallet credit on REFUND APPROVED
  if (responseStatus === "APPROVED" && msg.message_type === "REFUND") {
    try {
      await reverseCredit(
        msg.merchant.merchant_id,
        msg.amount.value,
        msg.amount.currency,
        msg.transaction_id,
        `Refund reversal — original tx ${msg.transaction_id}`
      );
    } catch (walletErr: any) {
      console.error(`[Wallet] Refund reversal failed for ${msg.transaction_id}:`, walletErr.message);
    }
  }

  // 12. Send webhook to merchant if registered
  const webhook = await WebhookModel.findOne({ merchant_id: msg.merchant.merchant_id });
  if (webhook && webhook.url) {
    sendWebhook(webhook.url, response);
  }

  res.json(response);
});

// Settlement endpoints
app.post('/settlement/daily/:merchant_id', async (req, res) => {
  try {
    const { terminal_id } = req.query;
    const batch = await generateDailySettlement(req.params.merchant_id, terminal_id as string);
    sendSettlementAlert(batch);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/settlement/weekly/:merchant_id', async (req, res) => {
  try {
    const { terminal_id } = req.query;
    const batch = await generateWeeklySettlement(req.params.merchant_id, terminal_id as string);
    sendSettlementAlert(batch);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/settlement/monthly/:merchant_id', async (req, res) => {
  try {
    const { terminal_id } = req.query;
    const batch = await generateMonthlySettlement(req.params.merchant_id, terminal_id as string);
    sendSettlementAlert(batch);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/settlement/:merchant_id', async (req, res) => {
  try {
    const settlements = await SettlementModel.find({ merchant_id: req.params.merchant_id }).sort({ created_at: -1 });
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/settlement/:batch_id/export', async (req, res) => {
  try {
    const { format = "json" } = req.query;
    const batch = await SettlementModel.findById(req.params.batch_id);
    
    if (!batch) {
      return res.status(404).json({ error: "Settlement batch not found" });
    }
    
    const transactions = await TransactionModel.find({ _id: { $in: batch.transactions } });
    
    if (format === "csv") {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=settlement-${batch.batch_id}.csv`);
      res.send(exportToCSV(batch, transactions));
    } else {
      res.json({ settlement: batch, transactions });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reconciliation endpoints
app.post('/reconciliation/:merchant_id', async (req, res) => {
  try {
    const { acquirer_records, start_date, end_date } = req.body;
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (start_date) startDate = new Date(start_date);
    if (end_date) endDate = new Date(end_date);
    
    const batch = await reconcileBatch(req.params.merchant_id, acquirer_records, startDate, endDate);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/reconciliation/:merchant_id', async (req, res) => {
  try {
    const reconciliations = await ReconciliationModel.find({ merchant_id: req.params.merchant_id }).sort({ created_at: -1 });
    res.json(reconciliations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// External Issuer Management
// Register and manage external money servers (customer wallets)
// ─────────────────────────────────────────────────────────────

// Register an external money server
app.post('/issuer/register', async (req, res) => {
  try {
    const { server_id, name, api_url, api_key, currency } = req.body;

    if (!server_id || !name || !api_url || !api_key) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Missing required fields: server_id, name, api_url, api_key'
      });
    }

    const existing = await ExternalIssuerModel.findOne({ server_id });
    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'External issuer already registered' });
    }

    const issuer = await ExternalIssuerModel.create({
      server_id,
      name,
      api_url,
      api_key,
      currency: currency || 'AED',
      status: 'ACTIVE'
    });

    res.json({
      status: 'SUCCESS',
      server_id: issuer.server_id,
      message: 'External issuer registered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// List all external issuers (api_key excluded)
app.get('/issuer', async (req, res) => {
  try {
    const issuers = await ExternalIssuerModel.find({}, { api_key: 0 });
    res.json(issuers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single external issuer by server_id (api_key excluded)
app.get('/issuer/:server_id', async (req, res) => {
  try {
    const issuer = await ExternalIssuerModel.findOne(
      { server_id: req.params.server_id },
      { api_key: 0 }
    );
    if (!issuer) return res.status(404).json({ error: 'Issuer not found' });
    res.json(issuer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Suspend or reactivate an issuer
app.patch('/issuer/:server_id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or SUSPENDED' });
    }
    await ExternalIssuerModel.updateOne({ server_id: req.params.server_id }, { status });
    res.json({ status: 'SUCCESS', server_id: req.params.server_id, new_status: status });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// CASH-OUT endpoint  —  POST /1016/cashout
// Flow: POS → 101.6 processor → External issuer → POS
// ─────────────────────────────────────────────────────────────
app.post('/1016/cashout', async (req, res) => {
  const msg = req.body as CashOutRequest;

  // 1. Validate protocol + message type
  if (msg.protocol !== '101.6' || msg.message_type !== 'CASH_OUT') {
    return res.status(400).json({
      error: 'Invalid protocol or message_type. Expected 101.6 / CASH_OUT'
    });
  }

  if (!msg.external_issuer?.server_id || !msg.external_issuer?.user_id) {
    return res.status(400).json({
      error: 'Missing external_issuer.server_id or external_issuer.user_id'
    });
  }

  if (!msg.amount?.value || msg.amount.value <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // 2. Verify terminal HMAC signature
  const terminalSecret = await getTerminalSecret(msg.merchant.terminal_id);
  const valid = verifyMessage(
    { ...msg, security: undefined },
    terminalSecret,
    msg.security.signature
  );

  if (!valid) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  // 3. Currency normalisation — always settle in AED
  let amount = msg.amount.value;
  let currency = msg.amount.currency;
  if (currency !== 'AED') {
    amount = convert(amount, currency, 'AED') || amount;
    currency = 'AED';
  }

  // 3.5. Offline CASH_OUT — store wallet record in CREATED state then queue it.
  //      No debit is attempted now. syncOfflineWalletDebit() handles it on next sync.
  if ((msg.transaction_flags as any).offline === true) {
    await createOfflineWalletRecord(
      msg.transaction_id,
      msg.external_issuer.server_id,
      msg.external_issuer.user_id,
      msg.merchant.terminal_id,
      amount,
      currency
    );
    await storeOffline(msg);
    return res.json({
      protocol:       '101.6',
      message_type:   'CASH_OUT_RESPONSE',
      transaction_id: msg.transaction_id,
      timestamp:      new Date().toISOString(),
      result: {
        status:      'PENDING',
        code:        'OF',
        description: 'Cash-out stored offline — wallet debit will occur on next sync'
      }
    });
  }

  // 4. Call the external issuer — the core of the CASH_OUT flow
  const issuerResponse = await callExternalIssuer(
    msg.external_issuer.server_id,
    msg.external_issuer.user_id,
    amount,
    currency,
    msg.transaction_id,
    msg.merchant.terminal_id
  );

  // 5. Map issuer response → 101.6 CASH_OUT_RESPONSE
  const responseStatus = issuerResponse.approved ? 'APPROVED' : 'DECLINED';
  const responseCode   = issuerResponse.approved ? '00' : (issuerResponse.error_code || 'XX');

  const response: CashOutResponse = {
    protocol: '101.6',
    message_type: 'CASH_OUT_RESPONSE',
    transaction_id: msg.transaction_id,
    timestamp: new Date().toISOString(),
    result: {
      status: responseStatus,
      code: responseCode,
      description: issuerResponse.approved ? 'CASH-OUT APPROVED' : issuerResponse.message,
      auth_code: issuerResponse.approved
        ? crypto.randomBytes(3).toString('hex').toUpperCase()
        : undefined,
      rrn: 'RR' + Date.now().toString().substring(2),
      stan: crypto.randomBytes(3).toString('hex').toUpperCase(),
      issuer_reference: issuerResponse.issuer_reference,
      balance_after: issuerResponse.balance_after
    },
    amount: { value: amount, currency },
    external_issuer: {
      server_id: msg.external_issuer.server_id,
      user_id: msg.external_issuer.user_id
    }
  };

  // 6. Sign response with terminal secret
  response.security = {
    nonce: msg.security.nonce,
    signature: signMessage({ ...response, security: undefined }, terminalSecret),
    algorithm: 'HMAC_SHA256'
  };

  // 7. Persist to cashout_transactions collection
  await CashOutTransactionModel.create({
    transaction_id: msg.transaction_id,
    timestamp: msg.timestamp,
    merchant: msg.merchant,
    amount: { value: amount, currency },
    external_issuer: {
      server_id: msg.external_issuer.server_id,
      user_id: msg.external_issuer.user_id,
      issuer_reference: issuerResponse.issuer_reference,
      balance_after: issuerResponse.balance_after
    },
    result: response.result,
    security: response.security,
    metadata: msg.metadata
  });

  // 8. Fire merchant webhook if registered
  const webhook = await WebhookModel.findOne({ merchant_id: msg.merchant.merchant_id });
  if (webhook?.url) {
    sendWebhook(webhook.url, response);
  }

  res.json(response);
});

// All cash-outs for a merchant
// All cash-outs across all merchants (dashboard overview)
// IMPORTANT: must be registered BEFORE /cashout/:merchant_id
// otherwise "all" gets matched as a merchant_id
app.get('/cashout/all', async (req, res) => {
  try {
    const cashouts = await CashOutTransactionModel.find({}).sort({ created_at: -1 });
    res.json(cashouts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Single cash-out by transaction_id
// IMPORTANT: must be before /cashout/:merchant_id too
app.get('/cashout/tx/:transaction_id', async (req, res) => {
  try {
    const cashout = await CashOutTransactionModel.findOne({
      transaction_id: req.params.transaction_id
    });
    if (!cashout) return res.status(404).json({ error: 'Cash-out transaction not found' });
    res.json(cashout);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// All cash-outs for a specific merchant — keep last (wildcard route)
app.get('/cashout/:merchant_id', async (req, res) => {
  try {
    const cashouts = await CashOutTransactionModel.find({
      'merchant.merchant_id': req.params.merchant_id
    }).sort({ created_at: -1 });
    res.json(cashouts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// Offline Queue — status + sync endpoints
// Terminals that were offline submit with transaction_flags.offline=true
// Those records land in OfflineQueueModel (PENDING).
// POST /offline/sync re-processes them through the full pipeline.
// ─────────────────────────────────────────────────────────────

// How many PENDING offline records exist?
app.get('/offline/status', async (req, res) => {
  try {
    const count = await getPendingCount();
    res.json({ pending: count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// List all offline records (admin view — filter by status)
app.get('/offline/queue', async (req, res) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const { OfflineQueueModel } = await import('./models/offlineQueue.js');
    const records = await OfflineQueueModel.find(filter).sort({ created_at: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Process all PENDING offline records through the full 101.6 pipeline
app.post('/offline/sync', async (req, res) => {
  try {
    const pending = await getPending();

    if (pending.length === 0) {
      return res.json({ synced: 0, failed: 0, message: 'No pending records' });
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of pending) {
      try {
        const msg = record.payload as any;

        // ── CASH_OUT: go through wallet state machine, never double-debit ──
        if (record.endpoint === '/1016/cashout') {
          const walletResult = await syncOfflineWalletDebit(msg.transaction_id);

          if (walletResult.status === 'DEBIT_CONFIRMED') {
            // Issuer approved — write final CashOut record if not already saved
            const existingCo = await CashOutTransactionModel.findOne({
              transaction_id: msg.transaction_id
            });

            if (!existingCo) {
              let amount   = msg.amount.value;
              let currency = msg.amount.currency;
              if (currency !== 'AED') {
                amount   = convert(amount, currency, 'AED') || amount;
                currency = 'AED';
              }

              await CashOutTransactionModel.create({
                transaction_id: msg.transaction_id,
                timestamp:      msg.timestamp,
                merchant:       msg.merchant,
                amount:         { value: amount, currency },
                external_issuer: {
                  server_id:        msg.external_issuer.server_id,
                  user_id:          msg.external_issuer.user_id,
                  issuer_reference: walletResult.issuer_reference,
                  balance_after:    walletResult.balance_after
                },
                result: {
                  status:      'APPROVED',
                  code:        '00',
                  description: 'Offline cash-out synced',
                  auth_code:   crypto.randomBytes(3).toString('hex').toUpperCase(),
                  rrn:         'RR' + Date.now().toString().substring(2),
                  stan:        crypto.randomBytes(3).toString('hex').toUpperCase()
                }
              });
            }

            await markSynced(record.transaction_id);
            synced++;
          } else {
            // Wallet debit failed — still retryable unless FAILED state was set
            errors.push(`${record.transaction_id}: ${walletResult.error}`);
            failed++;
          }
          continue;
        }

        // ── Regular SALE: re-process through the full transaction pipeline ──
        const saleMsg = msg as Protocol1016Request;
        saleMsg.transaction_flags.offline = false;

        // Re-verify HMAC
        const terminalSecret = await getTerminalSecret(saleMsg.merchant.terminal_id);
        const valid = verifyMessage(
          { ...saleMsg, security: undefined },
          terminalSecret,
          saleMsg.security.signature
        );

        if (!valid) {
          await markFailed(record.transaction_id, 'HMAC verification failed');
          failed++;
          errors.push(`${record.transaction_id}: HMAC failed`);
          continue;
        }

        // Check for duplicate
        const existing = await TransactionModel.findOne({
          transaction_id: saleMsg.transaction_id
        });
        if (existing) {
          await markSynced(record.transaction_id);
          synced++;
          continue;
        }

        // Currency normalisation
        if (saleMsg.amount.currency !== 'AED') {
          const converted = convert(saleMsg.amount.value, saleMsg.amount.currency, 'AED');
          saleMsg.amount.value    = converted || saleMsg.amount.value;
          saleMsg.amount.currency = 'AED';
        }

        // Tokenize PAN for MOTO (PCI compliance)
        if (saleMsg.card.entry_mode === 'MOTO' && saleMsg.card.pan) {
          const encrypted = encryptPAN(saleMsg.card.pan);
          const token = 'TKN-' + crypto.randomBytes(8).toString('hex');
          await VaultModel.create({
            token,
            encrypted_pan: encrypted,
            expiry_month:  saleMsg.card.expiry_month,
            expiry_year:   saleMsg.card.expiry_year
          });
          saleMsg.card.token = token;
          delete (saleMsg.card as any).pan;
        }

        const binInfo  = lookupBin(saleMsg.card.token || saleMsg.card.pan || '');
        const acquirer = routeToAcquirer(saleMsg);

        await TransactionModel.create({
          ...saleMsg,
          result: {
            status:      'APPROVED',
            code:        '00',
            description: 'Offline transaction synced',
            auth_code:   crypto.randomBytes(6).toString('hex').toUpperCase(),
            rrn:         'RR' + Date.now().toString().substring(2),
            stan:        crypto.randomBytes(3).toString('hex').toUpperCase()
          },
          card: {
            ...saleMsg.card,
            scheme:  binInfo?.scheme  || 'UNKNOWN',
            type:    binInfo?.type    || 'UNKNOWN',
            country: binInfo?.country || ''
          },
          metadata: { ...saleMsg.metadata, acquirer },
          flags: { offline_stored: true, reversal_required: false }
        });

        await markSynced(record.transaction_id);
        synced++;

      } catch (err: any) {
        await markFailed(record.transaction_id, err.message || 'Unknown error');
        failed++;
        errors.push(`${record.transaction_id}: ${err.message}`);
      }
    }

    res.json({
      total:  pending.length,
      synced,
      failed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// STN Verification endpoint
// Admin verifies a merchant's STN code before approving payout
// ─────────────────────────────────────────────────────────────

// Verify STN code — returns transaction details if valid
app.post('/stn/verify', async (req, res) => {
  try {
    const { stn_code, merchant_id } = req.body;
    if (!stn_code || !merchant_id) {
      return res.status(400).json({ error: "stn_code and merchant_id are required" });
    }
    const result = await verifySTN(stn_code, merchant_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// Merchant Wallet endpoints
// ─────────────────────────────────────────────────────────────

// Get wallet balance + info for a merchant
app.get('/wallet/:merchant_id', async (req, res) => {
  try {
    const wallet = await getWallet(req.params.merchant_id);
    if (!wallet) {
      // Wallet may not exist if merchant registered before this feature — create it
      const merchant = await MerchantModel.findOne({
        merchant_id: req.params.merchant_id
      });
      if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
      await ensureWallet(
        merchant.merchant_id as string,
        (merchant.name || merchant.merchant_id) as string,
        (merchant.currency || 'AED') as string
      );
      const created = await getWallet(req.params.merchant_id);
      return res.json(created);
    }
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get wallet ledger (transaction history)
app.get('/wallet/:merchant_id/ledger', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const ledger = await getWalletLedger(req.params.merchant_id, limit);
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update merchant bank account details (stored on wallet)
app.put('/wallet/:merchant_id/bank', async (req, res) => {
  try {
    const { account_name, account_number, bank_name, iban, swift, country } = req.body;
    if (!account_name || !account_number || !bank_name) {
      return res.status(400).json({ error: 'account_name, account_number and bank_name are required' });
    }
    await MerchantWalletModel.updateOne(
      { merchant_id: req.params.merchant_id },
      {
        bank_account: { account_name, account_number, bank_name, iban, swift, country },
        updated_at: new Date()
      }
    );
    res.json({ status: 'SUCCESS', message: 'Bank account updated' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Admin: freeze or unfreeze a wallet
app.patch('/wallet/:merchant_id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'FROZEN', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, FROZEN, or SUSPENDED' });
    }
    await MerchantWalletModel.updateOne(
      { merchant_id: req.params.merchant_id },
      { status, updated_at: new Date() }
    );
    res.json({ status: 'SUCCESS', new_status: status });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// Payout endpoints
// ─────────────────────────────────────────────────────────────

// Merchant submits a payout request
app.post('/wallet/:merchant_id/payout', async (req, res) => {
  try {
    const { amount, currency, bank_account, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!bank_account?.account_name || !bank_account?.account_number || !bank_account?.bank_name) {
      return res.status(400).json({
        error: 'bank_account must include account_name, account_number, bank_name'
      });
    }

    const result = await requestPayout(
      req.params.merchant_id,
      amount,
      currency || 'AED',
      bank_account,
      note
    );
    res.json({ status: 'SUCCESS', ...result });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// List payout requests for a merchant
app.get('/wallet/:merchant_id/payouts', async (req, res) => {
  try {
    const payouts = await PayoutRequestModel.find({
      merchant_id: req.params.merchant_id
    }).sort({ requested_at: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Admin: list ALL pending payout requests across all merchants
app.get('/admin/payouts', async (req, res) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const payouts = await PayoutRequestModel.find(filter).sort({ requested_at: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Admin: approve payout — verifies STN code, debits wallet, initiates bank transfer
app.post('/admin/payouts/:payout_id/approve', async (req, res) => {
  try {
    const { admin_note, stn_code } = req.body;

    // Require STN code for approval
    if (!stn_code) {
      return res.status(400).json({
        error: "STN code is required to approve a payout. Ask the merchant for the STN code from their receipt."
      });
    }

    // Get payout to find merchant_id
    const payout = await PayoutRequestModel.findOne({ payout_id: req.params.payout_id });
    if (!payout) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    // Verify STN code belongs to this merchant
    const stnResult = await verifySTN(stn_code, payout.merchant_id);
    if (!stnResult.valid) {
      return res.status(400).json({
        error: `STN verification failed: ${stnResult.reason}`
      });
    }

    // STN is valid — approve the payout
    const result = await approvePayout(req.params.payout_id, admin_note);

    // Mark STN as used so it can't be reused
    await markSTNUsed(stn_code);

    res.json({
      status: "SUCCESS",
      message: "Payout approved — STN verified",
      balance_after: result.balance_after,
      stn_transaction_id: stnResult.transaction_id
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Admin: mark payout as completed (bank transfer done)
app.post('/admin/payouts/:payout_id/complete', async (req, res) => {
  try {
    await completePayout(req.params.payout_id);
    res.json({ status: 'SUCCESS', message: 'Payout marked as completed' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Admin: reject payout
app.post('/admin/payouts/:payout_id/reject', async (req, res) => {
  try {
    const { admin_note } = req.body;
    if (!admin_note) {
      return res.status(400).json({ error: 'admin_note (reason) is required for rejection' });
    }
    await rejectPayout(req.params.payout_id, admin_note);
    res.json({ status: 'SUCCESS', message: 'Payout rejected' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// Offline Wallet State endpoints
// ─────────────────────────────────────────────────────────────

// Get wallet state for a single offline cash-out
app.get('/offline/wallet/:transaction_id', async (req, res) => {
  try {
    const record = await getWalletState(req.params.transaction_id);
    if (!record) return res.status(404).json({ error: 'Wallet record not found' });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// List all offline wallet records — optionally filter by status
app.get('/offline/wallet', async (req, res) => {
  try {
    const { OfflineWalletModel } = await import('./models/offlineWallet.js');
    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.server_id) filter.server_id = req.query.server_id;
    const records = await OfflineWalletModel.find(filter).sort({ created_at: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Void (reverse) an offline cash-out that was confirmed but cash not dispensed
app.post('/offline/wallet/:transaction_id/void', async (req, res) => {
  try {
    const result = await voidOfflineWalletDebit(req.params.transaction_id);
    if (result.voided) {
      res.json({ status: 'VOID_CONFIRMED', transaction_id: req.params.transaction_id });
    } else {
      res.status(400).json({ status: 'VOID_FAILED', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────
// NMI Webhook Endpoint
// ─────────────────────────────────────────────────────────────
app.post('/webhook/nmi', async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log("[NMI Webhook] Received:", webhookData);
    
    // Find the transaction by orderid (which is our transaction_id)
    const transactionId = webhookData.orderid;
    if (transactionId) {
      const transaction = await TransactionModel.findOne({ transaction_id: transactionId });
      
      if (transaction) {
        // Update transaction with webhook data
        transaction.metadata = {
          ...transaction.metadata,
          nmi_webhook: webhookData,
          nmi_transaction_id: webhookData.transactionid
        };
        
        await transaction.save();
        
        console.log(`[NMI Webhook] Updated transaction ${transactionId}`);
      }
    }
    
    // NMI expects a 200 response
    res.status(200).send("OK");
  } catch (error) {
    console.error("[NMI Webhook] Error:", error);
    // Still send 200 to prevent NMI from retrying
    res.status(200).send("OK");
  }
});

// ─────────────────────────────────────────────────────────────
// Admin Cashout Endpoints
// ─────────────────────────────────────────────────────────────

// 1. Initiate Admin Cashout - generates STN code
app.post('/admin/cashout/initiate', requireAuth, async (req, res) => {
  try {
    const { amount, currency, bank_account } = req.body;
    const admin_id = (req as any).admin.email; // Using email as admin_id
    
    const response = await initiateAdminCashout({
      admin_id,
      amount,
      currency: currency || "AED",
      bank_account
    });
    
    res.json(response);
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

// 2. Verify STN Code and Process Cashout
app.post('/admin/cashout/verify', requireAuth, async (req, res) => {
  try {
    const { stn_code } = req.body;
    
    const response = await verifyAndProcessAdminCashout({
      stn_code
    });
    
    res.json(response);
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

// 3. Get STN Code Details
app.get('/admin/cashout/stn/:stn_id', requireAuth, async (req, res) => {
  try {
    const stn = await getSTNDetails(req.params.stn_id);
    if (!stn) {
      return res.status(404).json({ error: "STN code not found" });
    }
    res.json(stn);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 4. Get All Admin STN Codes
app.get('/admin/cashout/stns', requireAuth, async (req, res) => {
  try {
    const admin_id = (req as any).admin.email;
    const stns = await getAdminSTNCodes(admin_id);
    res.json(stns);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`101.6 host running on port ${PORT}`);
});
