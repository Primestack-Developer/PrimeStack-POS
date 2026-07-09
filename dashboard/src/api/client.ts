import axios from "axios";

export const api = axios.create({
  baseURL: "", // proxy takes care of this
});
