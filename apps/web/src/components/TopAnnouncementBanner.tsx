import React, { useEffect, useState } from 'react'
import {
  fetchSystemAnnouncement,
  SystemAnnouncement,
  isServicePaused,
  STORAGE_KEY
} from '@/lib/settings'
import {
  Wrench,
  CloudSnow,
  Sparkles,
  Megaphone,
  Clock,
  X,
  AlertCircle
} from 'lucide-react'

export function TopAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // 1. Initial fetch
    fetchSystemAnnouncement().then(data => {
      setAnnouncement(data)
    })

    // 2. Real-time broadcast channel sync from Admin updates
    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('mistriji_settings_channel')
        bc.onmessage = (event) => {
          if (event.data?.type === 'ANNOUNCEMENT_UPDATED' && event.data?.payload) {
            setAnnouncement(event.data.payload)
            setDismissed(false)
          }
        }
      } catch {}
    }

    // 3. Storage event listener for cross-tab updates
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setAnnouncement(JSON.parse(e.newValue))
          setDismissed(false)
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)

    // 4. Refresh on window focus only (tab becomes active)
    function handleFocus() {
      fetchSystemAnnouncement().then(data => {
        setAnnouncement(data)
      })
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      if (bc) bc.close()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  if (!announcement || !announcement.enabled || dismissed) {
    return null
  }

  const pausedStatus = isServicePaused(announcement)

  const typeThemes: Record<string, { bg: string; badgeBg: string; textColor: string; icon: React.ReactNode }> = {
    maintenance: {
      bg: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 50%, #dc2626 100%)',
      badgeBg: 'rgba(255,255,255,0.2)',
      textColor: '#ffffff',
      icon: <Wrench size={16} />
    },
    weather: {
      bg: 'linear-gradient(90deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
      badgeBg: 'rgba(255,255,255,0.2)',
      textColor: '#ffffff',
      icon: <CloudSnow size={16} />
    },
    holiday: {
      bg: 'linear-gradient(90deg, #86198f 0%, #a21caf 50%, #c026d3 100%)',
      badgeBg: 'rgba(255,255,255,0.2)',
      textColor: '#ffffff',
      icon: <Sparkles size={16} />
    },
    custom: {
      bg: 'linear-gradient(90deg, #166534 0%, #15803d 50%, #16a34a 100%)',
      badgeBg: 'rgba(255,255,255,0.2)',
      textColor: '#ffffff',
      icon: <Megaphone size={16} />
    }
  }

  const theme = typeThemes[announcement.type] || typeThemes.maintenance

  return (
    <div
      className="top-announcement-banner"
      style={{
        background: theme.bg,
        color: theme.textColor,
      }}
    >
      <div className="top-announcement-container">
        <div className="top-announcement-main">
          {/* HEADER ROW: ICON, BADGE, TIME & PAUSE STATUS */}
          <div className="top-announcement-header-row">
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              {theme.icon}
            </span>
            <span
              className="top-announcement-title"
              style={{ background: theme.badgeBg }}
            >
              {announcement.title || 'Notice'}
            </span>

            {/* TIME WINDOW */}
            {(announcement.startTime || announcement.endTime) && (
              <span className="top-announcement-time">
                <Clock size={11} />
                {announcement.startTime || 'Start'} – {announcement.endTime || 'End'}
              </span>
            )}

            {/* BOOKINGS PAUSED INDICATOR */}
            {(announcement.pauseBookings || pausedStatus.isPaused) && (
              <span className="top-announcement-badge">
                ⚠️ Bookings Paused
              </span>
            )}
          </div>

          {/* MESSAGE */}
          <span className="top-announcement-msg">
            {announcement.message}
          </span>
        </div>

        {/* DISMISS BUTTON */}
        {announcement.dismissible && (
          <button
            onClick={() => setDismissed(true)}
            aria-label="Close notification banner"
            className="top-announcement-close"
            title="Dismiss"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
