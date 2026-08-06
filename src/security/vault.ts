import crypto from "crypto";

const vaultKeyHex = process.env.VAULT_KEY;
if (!vaultKeyHex || vaultKeyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(vaultKeyHex)) {
  throw new Error('VAULT_KEY must be a 64-character hex string');
}
const key = Buffer.from(vaultKeyHex, "hex");

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
