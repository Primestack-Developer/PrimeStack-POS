import axios from "axios";

export async function sendWebhook(url: string, payload: any) {
  try {
    await axios.post(url, payload);
  } catch (err) {
    console.log("Webhook failed:", url);
  }
}
