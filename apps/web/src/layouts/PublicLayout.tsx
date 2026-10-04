import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { TopAnnouncementBanner } from '@/components/TopAnnouncementBanner'

export function PublicLayout({ currentArea }: { currentArea: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Outlet />
    </div>
  )
}
