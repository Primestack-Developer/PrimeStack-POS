export function routeToAcquirer(msg: any): string {
  // If a default acquirer is explicitly configured, use it
  const defaultAcquirer = process.env.DEFAULT_ACQUIRER;
  if (defaultAcquirer) return defaultAcquirer;

  // Use the raw PAN BIN for routing (token starts with TKN- so can't be used)
  const pan = msg.card?.pan || "";
  const bin = pan.substring(0, 6);

  // NMI only if explicitly configured and BIN is Visa
  if (bin.startsWith("4") && process.env.NMI_SECURITY_KEY) return "NMI";

  // Everything else → Stripe (the configured real acquirer)
  return "STRIPE";
}
