import crypto from "crypto";

/**
 * Generate a unique receipt code for customer transactions
 * Format: REC-YYYYMMDD-XXXXXX (where XXXXXX is random)
 */
export function generateReceiptCode(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `REC-${dateStr}-${randomStr}`;
}

/**
 * Verify a receipt code (basic validation)
 */
export function verifyReceiptCode(code: string): boolean {
  // Basic format check: REC-YYYYMMDD-XXXXXX
  const pattern = /^REC-\d{8}-[A-F0-9]{6}$/;
  return pattern.test(code);
}
