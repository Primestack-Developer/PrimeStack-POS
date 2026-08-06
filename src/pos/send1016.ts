import axios from "axios";
import { Protocol1016Request } from "../types/1016.js";
import { storeOffline } from "./offlineQueue.js";

const POS_BACKEND_URL = process.env.POS_BACKEND_URL || "http://localhost:4000";

export async function send1016(msg: Protocol1016Request) {
  try {
    const res = await axios.post(`${POS_BACKEND_URL}/1016/transaction`, msg);
    return res.data;
  } catch (err) {
    msg.transaction_flags.offline = true;
    storeOffline(msg);
    return { status: "STORED_OFFLINE" };
  }
}
