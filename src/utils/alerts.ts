import axios from "axios";

export interface AlertConfig {
  webhookUrl?: string;
  slackWebhook?: string;
  email?: string;
}

export function sendAlert(message: string, config: AlertConfig = {}) {
  const webhookUrl = config.webhookUrl || config.slackWebhook || process.env.ALERT_WEBHOOK;
  
  if (webhookUrl) {
    try {
      axios.post(webhookUrl, {
        text: "[PRIMESTACK ALERT] " + new Date().toISOString() + " - " + message
      });
    } catch (error) {
      console.error("Failed to send alert:", error);
    }
  } else {
    console.log("[ALERT] " + message);
  }
}

export function sendFraudAlert(details: any) {
  sendAlert("FRAUD DETECTED: " + JSON.stringify(details));
}

export function sendErrorAlert(error: any) {
  sendAlert("ERROR: " + (error?.message || JSON.stringify(error)));
}

export function sendSettlementAlert(settlement: any) {
  sendAlert("Settlement generated: " + settlement.batch_id + " - " + settlement.merchant_id);
}
