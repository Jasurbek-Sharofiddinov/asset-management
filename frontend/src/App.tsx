import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'
import { Layout } from './components/layout/Layout'
import { PageLoader } from './components/ui/LoadingSpinner'
import { ToastProvider } from './components/ui/Toast'
import { APP_ORIGIN, loginMode } from './lib/config'
import type { UserRole } from './types'

// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AssetsPage = lazy(() => import('./pages/AssetsPage'))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const ScannerPage = lazy(() => import('./pages/ScannerPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function isRetryableError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === undefined || status < 400 || status >= 500
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => isRetryableError(error) && failureCount < 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
    mutations: {
      retry: false,
    },
  },
})

function AuthBootstrap() {
  const { isAuthenticated, loadUser } = useAuthStore()
  useEffect(() => {
    if (isAuthenticated) {
      loadUser()
    }
  }, [isAuthenticated, loadUser])
  return null
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}) {
  const { isAuthenticated, user } = useAuthStore()

  if (loginMode() === 'finder') {
    return <Navigate to="/login" replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children, redirectIfAuth = true }: { children: React.ReactNode; redirectIfAuth?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()

  if (loginMode() === 'finder') {
    return <>{children}</>
  }

  if (redirectIfAuth && isAuthenticated) {
    if (user?.must_change_password) {
      return <Navigate to="/change-password" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function ChangePasswordRoute() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!user?.must_change_password) {
    return <Navigate to="/dashboard" replace />
  }
  return <ChangePasswordPage />
}

function HomeRoute() {
  const { isAuthenticated } = useAuthStore()
  if (loginMode() === 'tenant') {
    return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
  }
  return (
    <PublicRoute redirectIfAuth={false}>
      <LandingPage />
    </PublicRoute>
  )
}

function SignupRoute() {
  if (loginMode() === 'tenant') {
    window.location.replace(`${APP_ORIGIN}/signup`)
    return null
  }
  return (
    <PublicRoute>
      <SignupPage />
    </PublicRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthBootstrap />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route path="/signup" element={<SignupRoute />} />
              <Route path="/change-password" element={<ChangePasswordRoute />} />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/assets/:id" element={<AssetDetailPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route
                  path="/audit"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                      <AuditPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/scanner" element={<ScannerPage />} />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to={loginMode() === 'finder' ? '/login' : '/dashboard'} replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
