import axios from "axios";
import { Protocol1016Request } from "../types/1016.js";
import { storeOffline } from "./offlineQueue.js";

export async function send1016(msg: Protocol1016Request) {
  try {
    const res = await axios.post("http://localhost:4000/1016/transaction", msg);
    return res.data;
  } catch (err) {
    msg.transaction_flags.offline = true;
    storeOffline(msg);
    return { status: "STORED_OFFLINE" };
  }
}
