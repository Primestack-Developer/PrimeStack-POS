import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ensureWallet } from "../logic/wallet.js";

// ─────────────────────────────────────────────────────────────
// AdminUser
// Single admin account for the dashboard.
// Password is bcrypt-hashed — never stored in plain text.
// Private key is a one-time recovery token — SHA-256 hashed.
// Cannot be reset once set. Used only if password is forgotten.
// ─────────────────────────────────────────────────────────────

const AdminUserSchema = new mongoose.Schema({
  email:              { type: String, required: true, unique: true, lowercase: true },
  password_hash:      { type: String, required: true },
  private_key_hash:   { type: String, required: true },  // SHA-256 of the private key
  created_at:         { type: Date, default: Date.now },
  last_login:         { type: Date }
});

export const AdminUserModel = mongoose.model("AdminUser", AdminUserSchema);

// ── Helpers ───────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashPrivateKey(key: string): string {
  // SHA-256 — deterministic, no salt — used for private key verification
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function seedAdminUser(): Promise<void> {
  const email      = process.env.ADMIN_EMAIL    || "admin@primestack.com";
  const existing   = await AdminUserModel.findOne({ email });
  if (existing) return;

  const privateKey   = process.env.ADMIN_PRIVATE_KEY || "4af5130083e8f7b200d4a1193c50818cb11dd786b13da2819d214f57e3c42287";
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD || "admin123");
  const pkHash       = hashPrivateKey(privateKey);

  await AdminUserModel.create({
    email,
    password_hash:    passwordHash,
    private_key_hash: pkHash
  });

  // Create admin wallet
  await ensureWallet("admin", "PrimeStack Admin", "AED");

  console.log(`✅  Admin user created: ${email}`);
  console.log(`✅  Admin wallet created`);
}
