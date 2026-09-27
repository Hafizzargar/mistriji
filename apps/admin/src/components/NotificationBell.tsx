import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Bell, Check, Info, AlertTriangle, Briefcase, MessageCircle, Shield, ExternalLink } from 'lucide-react'
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
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const fetchNotifications = async () => {
    if (!user?.id || !isValidUuid(user.id)) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error && data) {
      setNotifications(data as AppNotification[])
    }
  }

  useEffect(() => {
    if (!user?.id || !isValidUuid(user.id)) return

    fetchNotifications()

    // Real-time subscription
    const channelName = `notifications_bell_${user.id}_${Math.random().toString(36).substring(7)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Outside click listener
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

  const unreadCount = notifications.filter(n => !n.is_read).length
  const displayedNotifications = tab === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications

  const handleNotificationClick = async (notif: AppNotification) => {
    // Optimistically update read status locally so it does not disappear from view
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)

    setIsOpen(false)

    // Navigate to appropriate decision/inspection page based on type and content
    if (notif.type === 'system') {
      const msgLower = (notif.title + ' ' + notif.message).toLowerCase()
      if (msgLower.includes('customer')) {
        navigate('/customers')
      } else if (msgLower.includes('worker')) {
        navigate('/workers')
      } else if (msgLower.includes('service')) {
        navigate('/services')
      } else if (msgLower.includes('job') || msgLower.includes('booking')) {
        navigate('/jobs')
      } else {
        navigate('/admins?tab=history')
      }
    } else if (notif.type === 'booking_alert' || notif.type === 'job_update') {
      navigate('/jobs')
    } else if (notif.type === 'chat_message') {
      navigate('/support')
    } else {
      navigate('/notifications')
    }
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false)
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gray-600)',
          position: 'relative',
        }}
        title="Notifications"
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
            width: '380px',
            maxHeight: '480px',
            background: 'white',
            borderRadius: '0.875rem',
            boxShadow: '0 20px 35px -5px rgba(15, 23, 42, 0.2), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
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
              background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Notifications & Activity
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.5rem',
                  borderRadius: '9999px'
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--brand-600)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Sub-Tabs: All vs Unread */}
          <div style={{
            display: 'flex',
            padding: '0.4rem 0.75rem',
            background: '#ffffff',
            borderBottom: '1px solid var(--gray-100)',
            gap: '0.4rem'
          }}>
            <button
              onClick={() => setTab('all')}
              style={{
                flex: 1,
                padding: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: tab === 'all' ? 700 : 500,
                color: tab === 'all' ? 'var(--brand-700)' : 'var(--gray-600)',
                background: tab === 'all' ? 'var(--brand-50)' : 'transparent',
                borderRadius: '0.375rem',
                border: tab === 'all' ? '1px solid var(--brand-200)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              All Alerts ({notifications.length})
            </button>
            <button
              onClick={() => setTab('unread')}
              style={{
                flex: 1,
                padding: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: tab === 'unread' ? 700 : 500,
                color: tab === 'unread' ? '#dc2626' : 'var(--gray-600)',
                background: tab === 'unread' ? '#fef2f2' : 'transparent',
                borderRadius: '0.375rem',
                border: tab === 'unread' ? '1px solid #fecaca' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '330px' }}>
            {displayedNotifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                <Bell size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
                <p style={{ fontSize: '0.875rem', margin: 0, fontWeight: 600, color: 'var(--gray-600)' }}>
                  {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0', color: 'var(--gray-400)' }}>
                  {tab === 'unread' ? 'You have read all recent alerts! ✨' : 'Actions and alerts will appear here.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isSystem = notif.type === 'system'
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid var(--gray-100)',
                      background: notif.is_read 
                        ? (isSystem ? '#faf5ff' : '#ffffff') 
                        : (isSystem ? '#f3e8ff' : '#eff6ff'),
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease-in-out',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isSystem ? '#fae8ff' : '#e0f2fe')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = notif.is_read 
                      ? (isSystem ? '#faf5ff' : '#ffffff') 
                      : (isSystem ? '#f3e8ff' : '#eff6ff'))}
                  >
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      {isSystem ? (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#e9d5ff',
                          color: '#7e22ce',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Shield size={16} />
                        </div>
                      ) : notif.type === 'chat_message' ? (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#e0e7ff',
                          color: '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <MessageCircle size={16} />
                        </div>
                      ) : notif.type === 'booking_alert' ? (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#fef3c7',
                          color: '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AlertTriangle size={16} />
                        </div>
                      ) : (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Info size={16} />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <h4 style={{
                          fontSize: '0.8125rem',
                          fontWeight: notif.is_read ? 600 : 800,
                          color: isSystem ? '#581c87' : '#0f172a',
                          margin: 0,
                          lineHeight: 1.3
                        }}>
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: isSystem ? '#a855f7' : '#3b82f6',
                            flexShrink: 0,
                            marginTop: 3
                          }} />
                        )}
                      </div>

                      <p style={{
                        fontSize: '0.78125rem',
                        color: isSystem ? '#3b0764' : '#334155',
                        lineHeight: 1.45,
                        margin: 0,
                        wordBreak: 'break-word'
                      }}>
                        {notif.message}
                      </p>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.45rem',
                        fontSize: '0.7rem',
                        color: 'var(--gray-500)'
                      }}>
                        <span>
                          {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: isSystem ? '#9333ea' : 'var(--brand-600)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          Review details <ExternalLink size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Navigation */}
          <div style={{
            padding: '0.65rem 1rem',
            borderTop: '1px solid var(--gray-200)',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/admins?tab=history')
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#7e22ce',
                fontSize: '0.78125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Shield size={13} /> Admin Audit History
            </button>

            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--brand-600)',
                fontSize: '0.78125rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View all →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
