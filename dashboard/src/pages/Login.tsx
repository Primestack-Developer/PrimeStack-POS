import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, recoverWithPrivateKey, saveSession } from "../api/auth";

const P = "#0052FF";
const D = "#D50000";
const G = "#666";

export const Login: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab]         = useState<"login" | "recover">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [showPk, setShowPk]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, email: em } = await login(email, password);
      saveSession(token, em);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed — check credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { token, email: em } = await recoverWithPrivateKey(privateKey, newPassword);
      saveSession(token, em);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid private key");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 15,
    boxSizing: "border-box",
    outline: "none"
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "13px",
    background: disabled ? "#aaa" : P,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    marginTop: 8
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', Arial, sans-serif"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
      }}>
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: P, margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>P</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>
            PrimeStack POS
          </h1>
          <p style={{ margin: "4px 0 0", color: G, fontSize: 13 }}>
            Admin Dashboard
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderRadius: 8,
          background: "#f5f5f5", padding: 4, marginBottom: 24
        }}>
          {(["login", "recover"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", border: "none", borderRadius: 6,
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#111" : G,
                fontWeight: tab === t ? 700 : 400,
                fontSize: 13, cursor: "pointer",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
              }}
            >
              {t === "login" ? "Sign In" : "Recover Access"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#ffebee", color: D, padding: "10px 14px",
            borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600
          }}>
            {error}
          </div>
        )}

        {/* Login form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="admin@primestack.com"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  required value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", color: G, fontSize: 13
                  }}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: G, margin: 0 }}>
              Forgot password?{" "}
              <span
                style={{ color: P, cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setTab("recover"); setError(""); }}
              >
                Use private key
              </span>
            </p>
          </form>
        )}

        {/* Recovery form */}
        {tab === "recover" && (
          <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              background: "#fff8e1", padding: "10px 14px",
              borderRadius: 8, fontSize: 12, color: "#e65100"
            }}>
              Enter your private key to reset your password. The private key cannot be changed.
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
                Private Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPk ? "text" : "password"}
                  required value={privateKey}
                  onChange={e => setPrivateKey(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, paddingRight: 44 }}
                  placeholder="64-character private key"
                />
                <button
                  type="button"
                  onClick={() => setShowPk(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", color: G, fontSize: 13
                  }}
                >
                  {showPk ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
                New Password
              </label>
              <input
                type="password" required value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle} placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
                Confirm New Password
              </label>
              <input
                type="password" required value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle} placeholder="Repeat password"
              />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Resetting…" : "Reset Password & Sign In"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 24, marginBottom: 0 }}>
          PrimeStack 101.6 • Secure Admin Portal
        </p>
      </div>
    </div>
  );
};
