import dotenv from "dotenv";
dotenv.config();

export function routeToAcquirer(msg: any): string {
  // First, check if we have a default acquirer configured in environment
  const defaultAcquirer = process.env.DEFAULT_ACQUIRER;
  if (defaultAcquirer) {
    return defaultAcquirer;
  }

  const bin = (msg.card.token || msg.card.pan || "").substring(0, 6);

  if (bin.startsWith("4")) return "NMI";          // Visa → NMI
  if (bin.startsWith("5")) return "SHIFT4";       // Mastercard → Shift4
  if (bin.startsWith("3")) return "AMEX_DIRECT";  // Amex → Direct
  if (bin.startsWith("6011")) return "DISCOVER_NETWORK";
  if (bin.startsWith("65")) return "DISCOVER_NETWORK";
  if (bin.startsWith("62")) return "UNIONPAY_GATEWAY";
  if (bin.startsWith("35")) return "JCB_ACQUIRER";
  if (bin.startsWith("6521")) return "RUPAY_NPCI";

  return "FINIX"; // Default to Finix if no BIN match
}
