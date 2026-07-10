import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { TransactionDetails } from "./pages/TransactionDetails";
import { Terminals } from "./pages/Terminals";
import { MerchantProfile } from "./pages/MerchantProfile";
import { CashOutTransactions } from "./pages/CashOutTransactions";
import { MerchantWallet } from "./pages/MerchantWallet";
import { AdminPayouts } from "./pages/AdminPayouts";
import { AdminCashout } from "./pages/AdminCashout";
import { isLoggedIn } from "./api/auth";

// Protects all dashboard routes — redirects to /login if not authenticated
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — login page */}
        <Route path="/login" element={<Login />} />

        {/* Protected — all dashboard pages */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/"                  element={<Dashboard />} />
                  <Route path="/transactions"      element={<Transactions />} />
                  <Route path="/transactions/:id"  element={<TransactionDetails />} />
                  <Route path="/terminals"         element={<Terminals />} />
                  <Route path="/merchant"          element={<MerchantProfile />} />
                  <Route path="/cashout"           element={<CashOutTransactions />} />
                  <Route path="/wallet"            element={<MerchantWallet />} />
                  <Route path="/admin/payouts"     element={<AdminPayouts />} />
                  <Route path="/admin/cashout"     element={<AdminCashout />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
