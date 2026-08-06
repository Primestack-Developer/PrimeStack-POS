import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:4000" : undefined);
if (!API_URL) {
  throw new Error("Missing required environment variable REACT_APP_API_URL. Set it before building the dashboard.");
}

export const api = axios.create({
  baseURL: API_URL
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ps_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If token expires, redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ps_token");
      localStorage.removeItem("ps_email");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
