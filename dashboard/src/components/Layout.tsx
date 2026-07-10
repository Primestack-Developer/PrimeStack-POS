import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSession, getEmail } from "../api/auth";

// PrimeStack Brand Colors
const BRAND_PRIMARY = "#0052FF";
const BRAND_SECONDARY = "#0A0A0A";
const BRAND_ACCENT = "#00D1FF";
const BRAND_SUCCESS = "#00C853";
const BRAND_DANGER = "#D50000";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', Arial, sans-serif" }}>
      <aside style={{ 
        width: "250px", 
        background: BRAND_SECONDARY, 
        color: "#fff", 
        padding: "20px" 
      }}>
        <div style={{ marginBottom: "30px", textAlign: "center" }}>
          <img 
            src="/Logo.png" 
            alt="PrimeStack Logo" 
            style={{ 
              width: "80px", 
              height: "80px", 
              borderRadius: "16px",
              objectFit: "cover"
            }} 
          />
          <h1 style={{ marginTop: "12px", color: BRAND_ACCENT, fontWeight: "bold", fontSize: "24px" }}>PrimeStack</h1>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <Link 
            to="/" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1a1a1a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Dashboard
          </Link>
          <Link 
            to="/transactions" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1a1a1a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Transactions
          </Link>
          <Link 
            to="/terminals" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1a1a1a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Terminals
          </Link>
          <Link 
            to="/merchant" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1a1a1a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Merchant Profile
          </Link>
          <Link 
            to="/cashout" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cash-Outs
          </Link>

          {/* ── Divider ── */}
          <div style={{ borderTop: "1px solid #2a2a2a", margin: "8px 0" }} />

          <Link 
            to="/wallet" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            💳 Wallets
          </Link>
          <Link 
            to="/admin/payouts" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            💸 Payouts
          </Link>
          <Link 
            to="/admin/cashout" 
            style={{ 
              color: "#fff", 
              textDecoration: "none", 
              padding: "12px 15px", 
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            🏦 Admin Cashout
          </Link>

          {/* ── Divider ── */}
          <div style={{ borderTop: "1px solid #2a2a2a", margin: "8px 0" }} />

          {/* Logged-in user + logout */}
          <div style={{ padding: "8px 15px" }}>
            <div style={{ fontSize: "11px", color: "#888", marginBottom: "8px" }}>
              {getEmail()}
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "10px 15px",
                background: "transparent",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                textAlign: "left"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#D50000"; e.currentTarget.style.borderColor = "#D50000"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#333"; }}
            >
              🚪 Sign Out
            </button>
          </div>
        </nav>
      </aside>
      <main style={{ 
        flex: 1, 
        padding: "30px",
        background: "#f8f9fa"
      }}>
        {children}
      </main>
    </div>
  );
};
