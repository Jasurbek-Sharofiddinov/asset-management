import { Navigate, Route, Routes } from 'react-router-dom'
import { usePlatformAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import ConsoleLayout from './components/ConsoleLayout'
import OverviewPage from './pages/OverviewPage'
import OrganizationsPage from './pages/OrganizationsPage'
import OrgDetailPage from './pages/OrgDetailPage'
import NewOrganizationPage from './pages/NewOrganizationPage'
import AuditPage from './pages/AuditPage'

function Protected({ children }: { children: React.ReactNode }) {
  const token = usePlatformAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <ConsoleLayout />
          </Protected>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organizations/new" element={<NewOrganizationPage />} />
        <Route path="/organizations/:id" element={<OrgDetailPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
