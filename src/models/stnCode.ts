import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface ISTNCode extends Document {
  stn_id: string;
  code: string;
  type: "CASHOUT";
  amount: number;
  currency: string;
  admin_id: string;
  bank_account: {
    account_name: string;
    account_number: string;
    bank_name: string;
    iban?: string;
    swift?: string;
    country?: string;
  };
  status: "PENDING" | "VERIFIED" | "USED" | "EXPIRED";
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

const STNCodeSchema = new Schema<ISTNCode>({
  stn_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["CASHOUT"],
    default: "CASHOUT",
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: "AED"
  },
  admin_id: {
    type: String,
    required: true,
    index: true
  },
  bank_account: {
    account_name: { type: String, required: true },
    account_number: { type: String, required: true },
    bank_name: { type: String, required: true },
    iban: { type: String },
    swift: { type: String },
    country: { type: String }
  },
  status: {
    type: String,
    enum: ["PENDING", "VERIFIED", "USED", "EXPIRED"],
    default: "PENDING"
  },
  expires_at: {
    type: Date,
    required: true
  },
  used_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Generate a 6-digit STN code
function generateSTNCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Generate STN code expires after 15 minutes
function generateExpirationDate(): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 15);
  return date;
}

// Pre-save hook to generate stn_id, code, and expiration if not provided
STNCodeSchema.pre("save", function (this: ISTNCode) {
  if (!this.stn_id) {
    this.stn_id = `STN-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  }
  
  if (!this.code) {
    this.code = generateSTNCode();
  }
  
  if (!this.expires_at) {
    this.expires_at = generateExpirationDate();
  }
});

// Static method to generate a new STN code
STNCodeSchema.statics.generate = async function (
  adminId: string, amount: number, currency: string, bankAccount: any): Promise<ISTNCode> {
  const stnCode = new this({
    admin_id: adminId,
    amount,
    currency,
    bank_account: bankAccount
  });
  
  await stnCode.save();
  return stnCode;
};

// Static method to verify an STN code
STNCodeSchema.statics.verify = async function (code: string): Promise<ISTNCode | null> {
  const stnCode = await this.findOne({
    code,
    status: "PENDING",
    expires_at: { $gt: new Date() }
  });
  
  if (!stnCode) return null;
  
  // Update status to VERIFIED
  stnCode.status = "VERIFIED";
  await stnCode.save();
  
  return stnCode;
};

export const STNCodeModel = mongoose.model<ISTNCode>("STNCode", STNCodeSchema);
