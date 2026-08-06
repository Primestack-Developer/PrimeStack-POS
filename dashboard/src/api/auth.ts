import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:4000" : undefined);
if (!API_URL) {
  throw new Error("Missing required environment variable REACT_APP_API_URL. Set it before building the dashboard.");
}

export async function login(email: string, password: string) {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data as { token: string; email: string };
}

export async function recoverWithPrivateKey(private_key: string, new_password: string) {
  const res = await axios.post(`${API_URL}/auth/recover`, { private_key, new_password });
  return res.data as { message: string; token: string; email: string };
}

export function saveSession(token: string, email: string) {
  localStorage.setItem("ps_token", token);
  localStorage.setItem("ps_email", email);
}

export function clearSession() {
  localStorage.removeItem("ps_token");
  localStorage.removeItem("ps_email");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("ps_token");
}

export function getEmail(): string {
  return localStorage.getItem("ps_email") || "";
}
