import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/contexts/ToastContext'
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext'
import { CustomerLoginModal } from '@/components/CustomerLoginModal'
import { TopAnnouncementBanner } from '@/components/TopAnnouncementBanner'
import { SuspensionAlertModal } from '@/components/SuspensionAlertModal'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomePage } from '@/pages/HomePage'
import { MyBookingsPage } from '@/pages/MyBookingsPage'
import { AdminDispatchPage } from '@/pages/AdminDispatchPage'
import { WorkerDashboardPage } from '@/pages/WorkerDashboardPage'
import { NotificationsPage } from '@/pages/NotificationsPage'

const STORAGE_KEY = 'mistriji_current_area'

function AppInner({ currentArea, setCurrentArea }: { currentArea: string; setCurrentArea: (a: string) => void }) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopAnnouncementBanner />
      <Navbar currentArea={currentArea} />
      <CustomerLoginModal />
      <SuspensionAlertModal />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<HomePage currentArea={currentArea} onAreaChange={setCurrentArea} />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/worker" element={<WorkerDashboardPage />} />
          <Route path="/admin/dispatch" element={<AdminDispatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isHome && <Footer />}
    </div>
  )
}

export function App() {
  const [currentArea, setCurrentArea] = useState(() => {
    if (typeof window === 'undefined') return 'Gandhi Nagar'
    return localStorage.getItem(STORAGE_KEY) || 'Gandhi Nagar'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentArea)
  }, [currentArea])

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
