import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
  const existing = await AdminUserModel.findOne({ email: "admin@primestack.com" });
  if (existing) return; // already seeded

  const privateKey   = process.env.ADMIN_PRIVATE_KEY || crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD || "changeme");
  const pkHash       = hashPrivateKey(privateKey);

  await AdminUserModel.create({
    email:            "admin@primestack.com",
    password_hash:    passwordHash,
    private_key_hash: pkHash
  });

  if (!process.env.ADMIN_PRIVATE_KEY) {
    console.log("\n⚠️  ADMIN PRIVATE KEY (save this — shown only once):");
    console.log(`   ${privateKey}\n`);
  }
}
