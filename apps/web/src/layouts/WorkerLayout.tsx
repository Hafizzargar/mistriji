
import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { TopAnnouncementBanner } from '@/components/TopAnnouncementBanner'
import { WorkerBottomNav } from '@/components/WorkerBottomNav'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'

export function WorkerLayout({ currentArea }: { currentArea: string }) {
  const { customer } = useCustomerAuth()

  const storedCustomer = (() => {
    try {
      const s = localStorage.getItem('mistriji_customer')
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })()

  const activeUser = customer || storedCustomer

  if (!activeUser) {
    return <Navigate to="/" replace />
  }
  
  if (activeUser.role !== 'worker') {
    return <Navigate to="/customer/dashboard" replace />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f8fafc' }}>
      <TopAnnouncementBanner />
      <Navbar currentArea={currentArea} />
      <div className="worker-layout-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
      <WorkerBottomNav />
    </div>
  )
}
