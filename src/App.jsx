import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import MerchantsPage from './pages/merchants/MerchantsPage'
import MerchantDetailsPage from './pages/merchants/MerchantDetailsPage'
import CustomerDetailsPage from './pages/merchants/CustomerDetailsPage'
import WalletsPage from './pages/wallets/WalletsPage'
import TransactionsPage from './pages/transactions/TransactionsPage'
import CompliancePage from './pages/compliance/CompliancePage'
import DisputesPage from './pages/disputes/DisputesPage'
import SettlementsPage from './pages/settlements/SettlementsPage'
import ReportsPage from './pages/reports/ReportsPage'
import AdminPage from './pages/admin/AdminPage'
import PageLoader from './components/ui/PageLoader'

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-page">
        <PageLoader label="Loading session…" minHeight="min-h-0" padding="py-0" size={32} />
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/merchants" element={<MerchantsPage />} />
        <Route path="/merchants/:accountKey" element={<MerchantDetailsPage />} />
        <Route path="/merchants/:accountKey/customers/:identifier" element={<CustomerDetailsPage />} />
        <Route path="/customers" element={<Navigate to="/merchants" replace />} />
        <Route path="/wallets" element={<WalletsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
