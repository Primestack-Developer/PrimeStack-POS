import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const wallet = await db.collection('merchantwallets').findOne({ merchant_id: 'MRC-10001' });
if (!wallet) {
  await db.collection('merchantwallets').insertOne({
    merchant_id: 'MRC-10001',
    merchant_name: 'PrimeStack Store',
    currency: 'AED',
    balance: 0,
    pending_balance: 0,
    total_credited: 0,
    total_debited: 0,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date()
  });
  console.log('Wallet created for MRC-10001');
} else {
  console.log('Wallet exists — balance:', wallet.balance, wallet.currency);
}
await mongoose.disconnect();
