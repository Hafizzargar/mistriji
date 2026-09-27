import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Bell, Check, Trash2, MessageCircle, Briefcase, 
  Info, CheckCheck, Clock, Search, Filter, ArrowUpRight, Sparkles, Shield
} from 'lucide-react'

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

export function NotificationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialFilter = (searchParams.get('tab') as any) || 'all'
  
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'chat_message' | 'booking_alert' | 'system'>(initialFilter)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications()

    const channel = supabase
      .channel(`admin_notif_page_${user.id}`)
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

  const fetchNotifications = async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error)
    } else if (data) {
      setNotifications(data as AppNotification[])
    }
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false)
    toast.success('All notifications marked as read')
  }

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete notification')
      fetchNotifications()
    } else {
      toast.success('Notification removed')
    }
  }

  const clearAllRead = async () => {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id)
    if (readIds.length === 0) {
      toast.info('No read notifications to clear')
      return
    }
    setNotifications(prev => prev.filter(n => !n.is_read))
    await supabase.from('notifications').delete().in('id', readIds)
    toast.success('Cleared all read notifications')
  }

  const handleAction = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markAsRead(notif.id)
    }
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
    } else if (notif.type === 'chat_message') {
      navigate('/support')
    } else if (notif.type === 'booking_alert' || notif.type === 'job_update') {
      navigate('/jobs')
    }
  }

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return dateStr
    }
  }

  const getIconAndStyle = (type: string) => {
    switch (type) {
      case 'chat_message':
        return {
          icon: <MessageCircle size={18} />,
          bg: '#e0e7ff',
          color: '#4338ca',
          badgeText: 'Support Chat',
          badgeBg: '#eef2ff',
          badgeColor: '#4f46e5'
        }
      case 'booking_alert':
        return {
          icon: <Briefcase size={18} />,
          bg: '#fef3c7',
          color: '#b45309',
          badgeText: 'Service Request',
          badgeBg: '#fffbeb',
          badgeColor: '#d97706'
        }
      case 'job_update':
        return {
          icon: <Check size={18} />,
          bg: '#d1fae5',
          color: '#047857',
          badgeText: 'Job Status',
          badgeBg: '#ecfdf5',
          badgeColor: '#059669'
        }
      case 'system':
        return {
          icon: <Shield size={18} />,
          bg: '#fdf4ff',
          color: '#c026d3',
          badgeText: 'Admin Action',
          badgeBg: '#fae8ff',
          badgeColor: '#a21caf'
        }
      default:
        return {
          icon: <Info size={18} />,
          bg: '#f1f5f9',
          color: '#475569',
          badgeText: 'System Alert',
          badgeBg: '#f8fafc',
          badgeColor: '#64748b'
        }
    }
  }

  // Filtering
  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'unread' && n.is_read) return false
    if (filterType === 'chat_message' && n.type !== 'chat_message') return false
    if (filterType === 'booking_alert' && (n.type !== 'booking_alert' && n.type !== 'job_update')) return false
    if (filterType === 'system' && n.type !== 'system') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    }
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length
  const chatCount = notifications.filter(n => n.type === 'chat_message').length
  const jobCount = notifications.filter(n => n.type === 'booking_alert' || n.type === 'job_update').length
  const systemCount = notifications.filter(n => n.type === 'system').length

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1.5rem 1.75rem',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '1rem',
        color: '#fff',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '0.625rem',
              background: 'rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a5b4fc'
            }}>
              <Bell size={20} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                animation: 'pulse 2s infinite'
              }}>
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
            Stay updated with incoming booking requests, customer support messages, and system alerts.
          </p>
        </div>

        {/* Global actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.625rem',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button
              onClick={clearAllRead}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.625rem',
                color: '#fca5a5',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Trash2 size={16} /> Clear read
            </button>
          )}
        </div>
      </div>

      {/* Control Bar (Search & Filter Tabs) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${notifications.length})` },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'system', label: `🛡️ Admin Actions (${systemCount})` },
            { id: 'chat_message', label: `Support (${chatCount})` },
            { id: 'booking_alert', label: `Jobs (${jobCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              style={{
                padding: '0.5rem 0.875rem',
                borderRadius: '0.5rem',
                border: filterType === tab.id ? '1px solid var(--brand-500)' : '1px solid var(--gray-200)',
                background: filterType === tab.id ? 'var(--brand-50)' : '#fff',
                color: filterType === tab.id ? 'var(--brand-600)' : 'var(--gray-600)',
                fontWeight: filterType === tab.id ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--gray-200)',
              fontSize: '0.8125rem',
              outline: 'none',
              background: '#fff'
            }}
          />
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem', color: 'var(--brand-500)' }} />
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div style={{
          background: '#fff',
          borderRadius: '1rem',
          border: '1px dashed var(--gray-300)',
          padding: '4rem 2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--gray-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--gray-400)'
          }}>
            <Bell size={28} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-800)', margin: '0 0 0.5rem' }}>
            No notifications found
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0, maxWidth: 360, marginInline: 'auto' }}>
            {filterType === 'unread' 
              ? "You're all caught up! There are no unread notifications right now."
              : "No notifications match your current filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredNotifications.map(notif => {
            const styleInfo = getIconAndStyle(notif.type)
            return (
              <div
                key={notif.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1.125rem 1.25rem',
                  background: notif.is_read ? '#fff' : '#f8faff',
                  borderRadius: '0.875rem',
                  border: notif.is_read ? '1px solid var(--gray-200)' : '1px solid #bfdbfe',
                  boxShadow: notif.is_read ? '0 1px 3px rgba(0,0,0,0.04)' : '0 4px 12px rgba(59, 130, 246, 0.08)',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                {/* Left side: Icon + Content */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                  {/* Type Icon */}
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '0.75rem',
                    background: styleInfo.bg,
                    color: styleInfo.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2
                  }}>
                    {styleInfo.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Top Meta Line: Badge + Title + Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.375rem',
                        background: styleInfo.badgeBg,
                        color: styleInfo.badgeColor
                      }}>
                        {styleInfo.badgeText}
                      </span>
                      
                      <h4 style={{
                        fontSize: '0.9375rem',
                        fontWeight: notif.is_read ? 600 : 700,
                        color: notif.is_read ? 'var(--gray-800)' : '#1e3a8a',
                        margin: 0
                      }}>
                        {notif.title}
                      </h4>

                      {!notif.is_read && (
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#3b82f6',
                          display: 'inline-block'
                        }} />
                      )}
                    </div>

                    {/* Message Body */}
                    <p style={{
                      margin: '0 0 0.5rem',
                      fontSize: '0.875rem',
                      color: notif.is_read ? 'var(--gray-600)' : 'var(--gray-800)',
                      lineHeight: 1.45,
                      fontWeight: notif.is_read ? 400 : 500
                    }}>
                      {notif.message}
                    </p>

                    {/* Timestamp & Action hint */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                        <Clock size={12} /> {formatTimestamp(notif.created_at)}
                      </span>

                      {notif.type === 'system' ? (
                        <button
                          onClick={() => handleAction(notif)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#7e22ce',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: 0
                          }}
                        >
                          Inspect Decision Desk <ArrowUpRight size={13} />
                        </button>
                      ) : (notif.type === 'chat_message' || notif.type === 'booking_alert' || notif.type === 'job_update') && (
                        <button
                          onClick={() => handleAction(notif)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--brand-600)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: 0
                          }}
                        >
                          {notif.type === 'chat_message' ? 'Open Chat' : 'View Job'} <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  {!notif.is_read && (
                    <button
                      title="Mark as read"
                      onClick={() => markAsRead(notif.id)}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--gray-200)',
                        background: '#fff',
                        color: 'var(--gray-600)',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    title="Delete notification"
                    onClick={() => deleteNotification(notif.id)}
                    style={{
                      padding: '0.4rem',
                      borderRadius: '0.375rem',
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: 'var(--gray-400)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--gray-400)'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
