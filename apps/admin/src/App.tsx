import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { AdminLayout }  from '@/components/layout/AdminLayout'
import { LoginPage }    from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { WorkersPage }   from '@/pages/WorkersPage'
import { WorkerEnrollPage } from '@/pages/WorkerEnrollPage'
import { JobsPage }      from '@/pages/JobsPage'
import { JobDetailsPage } from '@/pages/JobDetailsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { CustomerEnrollPage } from '@/pages/CustomerEnrollPage'
import { ServicesPage }  from '@/pages/ServicesPage'
import { AdminsPage }    from '@/pages/AdminsPage'
import { SettingsPage }  from '@/pages/SettingsPage'
import { ManageAreasPage } from '@/pages/ManageAreasPage'
import { PaymentHistoryPage } from '@/pages/PaymentHistoryPage'
import { SupportInboxPage } from '@/pages/SupportInboxPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import ErrorCenterPage from '@/pages/ErrorCenterPage'

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🔒</div>
          <div className="spinner" style={{ color: 'var(--brand-500)', width: 28, height: 28 }} />
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Checking admin access…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public Login & Secret Gate */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal-hq-sec-9982/login" element={<LoginPage />} />

            {/* Protected admin routes */}
            <Route element={<AdminLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"      element={<DashboardPage />} />
              <Route path="/workers"        element={<WorkersPage />} />
              <Route path="/workers/enroll" element={<WorkerEnrollPage />} />
              <Route path="/jobs"           element={<JobsPage />} />
              <Route path="/jobs/:id"       element={<JobDetailsPage />} />
              <Route path="/customers"        element={<CustomersPage />} />
              <Route path="/customers/enroll" element={<CustomerEnrollPage />} />
              <Route path="/payments"       element={<PaymentHistoryPage />} />
              <Route path="/support"        element={<SupportInboxPage />} />
              <Route path="/notifications"  element={<NotificationsPage />} />
              <Route path="/skills"         element={<ServicesPage />} />
              <Route path="/services"       element={<ServicesPage />} />
              <Route path="/admins" element={<RequireSuperAdmin><AdminsPage /></RequireSuperAdmin>} />
              <Route path="/errors" element={<RequireSuperAdmin><ErrorCenterPage /></RequireSuperAdmin>} />
              <Route path="/settings"       element={<SettingsPage />} />
              <Route path="/settings/areas" element={<ManageAreasPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🚧</div>
          <div className="empty-state-title">Coming Soon</div>
          <div className="empty-state-desc">This section is under development.</div>
        </div>
      </div>
    </div>
  )
}
