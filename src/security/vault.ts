import crypto from "crypto";

// 32 bytes (256 bits) AES key, stored in VAULT_KEY environment variable
const key = Buffer.from(process.env.VAULT_KEY || "0".repeat(64), "hex");

export function encryptPAN(pan: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(pan, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export function decryptPAN(data: string) {
  const [ivStr, encrypted] = data.split(":");
  const iv = Buffer.from(ivStr, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
