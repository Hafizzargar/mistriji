import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/contexts/ToastContext'
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext'
import { CustomerLoginModal } from '@/components/CustomerLoginModal'
import { WorkerAuthModal } from '@/components/WorkerAuthModal'
import { TopAnnouncementBanner } from '@/components/TopAnnouncementBanner'
import { SuspensionAlertModal } from '@/components/SuspensionAlertModal'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

import { LandingPage } from '@/pages/LandingPage'
import { CustomerDashboardPage } from '@/pages/CustomerDashboardPage'
import { MyBookingsPage } from '@/pages/MyBookingsPage'
import { AdminDispatchPage } from '@/pages/AdminDispatchPage'
import { WorkerDashboardPage } from '@/pages/WorkerDashboardPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PublicLayout } from '@/layouts/PublicLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { WorkerLayout } from '@/layouts/WorkerLayout'
import { API_BASE_URL } from '@/lib/config'

const STORAGE_KEY = 'mistriji_current_area'

function AppInner({ currentArea, setCurrentArea }: { currentArea: string; setCurrentArea: (a: string) => void }) {
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false)

  useEffect(() => {
    const handleOpenWorkerModal = () => setIsWorkerModalOpen(true)
    window.addEventListener('open-worker-register', handleOpenWorkerModal)
    return () => window.removeEventListener('open-worker-register', handleOpenWorkerModal)
  }, [])
  return (
    <>
      <CustomerLoginModal />
      <WorkerAuthModal isOpen={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} /> 
      <Routes>
        {/* PUBLIC MARKETING PAGES */}
        <Route element={<PublicLayout currentArea={currentArea} />}>
          <Route path="/" element={<LandingPage />} />
        </Route>

        {/* CUSTOMER APPLICATION */}
        <Route path="/customer" element={<CustomerLayout currentArea={currentArea} />}>
          <Route index element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboardPage currentArea={currentArea} onAreaChange={setCurrentArea} />} />
          <Route path="bookings" element={<MyBookingsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* WORKER APPLICATION */}
        <Route path="/worker" element={<WorkerLayout currentArea={currentArea} />}>
          <Route index element={<Navigate to="/worker/dashboard" replace />} />
          <Route path="dashboard" element={<WorkerDashboardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* ALIASES */}
        <Route path="/notifications" element={<Navigate to="/customer/notifications" replace />} />
        <Route path="/my-bookings" element={<Navigate to="/customer/bookings" replace />} />

        {/* ADMIN/MISC */}
        <Route path="/admin/dispatch" element={<AdminDispatchPage />} />
        
        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export function App() {
  const [currentArea, setCurrentArea] = useState(() => {
    if (typeof window === 'undefined') return 'Gandhi Nagar'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored || stored === 'Doda') {
      localStorage.setItem(STORAGE_KEY, 'Gandhi Nagar')
      return 'Gandhi Nagar'
    }
    return stored
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentArea)
  }, [currentArea])

  useEffect(() => {
    // Wake up Render backend on app launch to prevent free-tier cold start delays
    fetch(`${API_BASE_URL}/api/health`).catch(() => {})
  }, [])

  return (
    <ToastProvider>
      <CustomerAuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppInner currentArea={currentArea} setCurrentArea={setCurrentArea} />
        </BrowserRouter>
      </CustomerAuthProvider>
    </ToastProvider>
  )
}

export default App
