import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { Bell, Check, Info, AlertTriangle, Briefcase, MessageCircle } from 'lucide-react'

import { useNavigate } from 'react-router-dom'

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'booking_alert' | 'job_update' | 'system' | 'chat_message'
  is_read: boolean
  reference_id: string | null
  created_at: string
}

export function NotificationBell() {
  const { customer, isLoggedIn } = useCustomerAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoggedIn || !customer?.id || customer.id.startsWith('guest-')) return

    // Fetch initial unread notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', customer.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setNotifications(data as AppNotification[])
      }
    }

    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications_${customer.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${customer.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification
          if (!newNotif.is_read) {
            setNotifications((prev) => [newNotif, ...prev.filter(n => n.id !== newNotif.id)])
            try {
              new Audio('/notification.mp3').play().catch(() => {})
            } catch(e) {}
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${customer.id}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification
          if (updated.is_read) {
            setNotifications((prev) => prev.filter((n) => n.id !== updated.id))
          } else {
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customer?.id, isLoggedIn])

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const unreadCount = notifications.length

  const navigate = useNavigate()

  const markAsReadAndNavigate = async (notif: AppNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
    setIsOpen(false)
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)

    if (notif.type === 'job_update' || notif.type === 'booking_alert') {
      if (customer?.role === 'worker') {
        navigate('/worker')
      } else {
        navigate('/my-bookings')
      }
    } else if (notif.type === 'chat_message') {
      window.dispatchEvent(new CustomEvent('open-support-chat'))
    }
  }

  const markAllAsRead = async () => {
    setNotifications([])
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', customer?.id).eq('is_read', false)
  }

  if (!isLoggedIn || customer?.id?.startsWith('guest-')) return null

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-circle"
        style={{
          color: 'var(--gray-600)',
          position: 'relative',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              minWidth: '16px',
              height: '16px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid white',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '0.5rem',
            width: '320px',
            maxHeight: '400px',
            background: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--gray-200)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.875rem 1rem',
              borderBottom: '1px solid var(--gray-200)',
              background: 'var(--gray-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
                Unread Alerts
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--brand-100)',
                  color: 'var(--brand-700)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--brand-600)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                <Bell size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                <p style={{ fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>No unread notifications</p>
                <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0', color: 'var(--gray-400)' }}>You're all caught up! ✨</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsReadAndNavigate(notif)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--gray-100)',
                    background: notif.is_read ? 'white' : '#f0f9ff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '0.75rem',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = notif.is_read ? '#f8fafc' : '#e0f2fe')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = notif.is_read ? 'white' : '#f0f9ff')}
                >
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {notif.type === 'chat_message' ? (
                      <MessageCircle size={18} style={{ color: '#4f46e5' }} />
                    ) : notif.type === 'booking_alert' ? (
                      <AlertTriangle size={18} style={{ color: '#eab308' }} />
                    ) : notif.type === 'job_update' ? (
                      <Briefcase size={18} style={{ color: 'var(--brand-500)' }} />
                    ) : (
                      <Info size={18} style={{ color: '#3b82f6' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: notif.is_read ? 600 : 700, color: 'var(--gray-900)' }}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }}></div>}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', lineHeight: 1.4 }}>
                      {notif.message}
                    </p>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>
                      {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer - View All Link */}
          <div style={{
            padding: '0.75rem',
            borderTop: '1px solid var(--gray-100)',
            background: '#fafafa',
            textAlign: 'center'
          }}>
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--brand-600)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
