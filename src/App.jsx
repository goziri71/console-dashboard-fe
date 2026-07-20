import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import MerchantsPage from './pages/merchants/MerchantsPage'
import MerchantDetailsPage from './pages/merchants/MerchantDetailsPage'
import CustomerDetailsPage from './pages/merchants/CustomerDetailsPage'
import CustomerKycPage from './pages/merchants/CustomerKycPage'
import WalletsPage from './pages/wallets/WalletsPage'
import TransactionsPage from './pages/transactions/TransactionsPage'
import CompliancePage from './pages/compliance/CompliancePage'
import DisputesPage from './pages/disputes/DisputesPage'
import SettlementsPage from './pages/settlements/SettlementsPage'
import ReportsPage from './pages/reports/ReportsPage'
import AdminPage from './pages/admin/AdminPage'
import MfaStepUpProvider from './components/auth/MfaStepUpProvider'

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!token) {
    return <Navigate to={{ pathname: '/login', search: location.search }} replace />
  }

  return children
}

/** Send unknown paths to /login, keeping the query string so a Crosslink `?token=` survives. */
function RedirectToLogin() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/login', search: location.search }} replace />
}

/** Hosts often 301 `/login` → `/login/`; keep `?token=` and normalize the path. */
function TrailingSlashFix({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname.length > 1 && location.pathname.endsWith('/')) {
      navigate(
        { pathname: location.pathname.replace(/\/+$/, ''), search: location.search, hash: location.hash },
        { replace: true }
      )
    }
  }, [location.pathname, location.search, location.hash, navigate])

  return children
}

function AppRoutes() {
  return (
    <TrailingSlashFix>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/" element={<LoginPage />} />
        <Route path="/register" element={<RedirectToLogin />} />
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
          <Route path="/merchants/:accountKey/customers/:identifier/kyc" element={<CustomerKycPage />} />
          <Route path="/merchants/:accountKey/customers/:identifier" element={<CustomerDetailsPage />} />
          <Route path="/customers/:identifier" element={<CustomerDetailsPage />} />
          <Route path="/customers" element={<Navigate to="/merchants" replace />} />
          <Route path="/wallets" element={<WalletsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/disputes" element={<DisputesPage />} />
          <Route path="/settlements" element={<SettlementsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    </TrailingSlashFix>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MfaStepUpProvider>
          <AppRoutes />
        </MfaStepUpProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
