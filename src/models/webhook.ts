import mongoose from "mongoose";

const WebhookSchema = new mongoose.Schema({
  merchant_id: String,
  url: String
});

export const WebhookModel = mongoose.model("Webhook", WebhookSchema);
