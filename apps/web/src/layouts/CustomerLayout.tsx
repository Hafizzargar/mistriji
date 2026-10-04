import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { TopAnnouncementBanner } from '@/components/TopAnnouncementBanner'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

export function CustomerLayout({ currentArea }: { currentArea: string }) {
  const { isLoggedIn, customer } = useCustomerAuth()
  
  if (!isLoggedIn || !customer) {
    return <Navigate to="/" replace />
  }
  
  if (customer.role === 'worker') {
    return <Navigate to="/worker/dashboard" replace />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f8fafc' }}>
      <TopAnnouncementBanner />
      <Navbar currentArea={currentArea} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  )
}
