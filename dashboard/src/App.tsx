import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { TransactionDetails } from "./pages/TransactionDetails";
import { Terminals } from "./pages/Terminals";
import { MerchantProfile } from "./pages/MerchantProfile";
import { CashOutTransactions } from "./pages/CashOutTransactions";
import { MerchantWallet } from "./pages/MerchantWallet";
import { AdminPayouts } from "./pages/AdminPayouts";

function App() {
  return (
    <BrowserRouter>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
