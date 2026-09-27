import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, Check, Trash2, MessageCircle, Briefcase, 
  Info, CheckCheck, Clock, Search, ArrowUpRight, ArrowLeft 
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
  const { customer, isLoggedIn } = useCustomerAuth()
  const toast = useToast()
  const navigate = useNavigate()
  
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'chat_message' | 'job_update'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!isLoggedIn || !customer?.id) return

    fetchNotifications()

    const channel = supabase
      .channel(`web_notif_page_${customer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${customer.id}`,
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customer?.id, isLoggedIn])

  const fetchNotifications = async () => {
    if (!customer?.id) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', customer.id)
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
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', customer?.id).eq('is_read', false)
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

  const handleAction = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markAsRead(notif.id)
    }
    if (notif.type === 'chat_message') {
      window.dispatchEvent(new CustomEvent('open-support-chat'))
    } else if (notif.type === 'booking_alert' || notif.type === 'job_update') {
      if (customer?.role === 'worker') {
        navigate('/worker')
      } else {
        navigate('/my-bookings')
      }
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
          icon: <MessageCircle size={20} />,
          bg: '#eef2ff',
          color: '#4f46e5',
          badgeText: 'Support Chat',
          badgeBg: '#e0e7ff',
          badgeColor: '#3730a3',
          borderColor: '#c7d2fe'
        }
      case 'booking_alert':
        return {
          icon: <Briefcase size={20} />,
          bg: '#fffbeb',
          color: '#d97706',
          badgeText: 'Booking Alert',
          badgeBg: '#fef3c7',
          badgeColor: '#92400e',
          borderColor: '#fde68a'
        }
      case 'job_update':
        return {
          icon: <Check size={20} />,
          bg: '#ecfdf5',
          color: '#059669',
          badgeText: 'Status Update',
          badgeBg: '#d1fae5',
          badgeColor: '#065f46',
          borderColor: '#a7f3d0'
        }
      default:
        return {
          icon: <Info size={20} />,
          bg: '#f1f5f9',
          color: '#475569',
          badgeText: 'System Notice',
          badgeBg: '#e2e8f0',
          badgeColor: '#334155',
          borderColor: '#cbd5e1'
        }
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem', maxWidth: 640, textAlign: 'center' }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #eef2ff, #fdf4ff)',
          border: '1.5px solid #c7d2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: '#4f46e5'
        }}>
          <Bell size={32} />
        </div>
        <h2 style={{ color: '#1e1b4b', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Your Notifications
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
          Please log in to view your real-time booking updates and support replies.
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ fontWeight: 700, borderRadius: '0.75rem', padding: '0.625rem 1.5rem' }}>
          Back to Home
        </button>
      </div>
    )
  }

  // Filtering
  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'unread' && n.is_read) return false
    if (filterType === 'chat_message' && n.type !== 'chat_message') return false
    if (filterType === 'job_update' && (n.type !== 'job_update' && n.type !== 'booking_alert')) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    }
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: 760 }}>
      {/* Header with Navigation */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <a
            href="/"
            onClick={e => { e.preventDefault(); navigate('/') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#4f46e5', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' }}
          >
            <ArrowLeft size={15} /> Back to Home
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
            Updates regarding your service bookings and support messages.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 700,
              borderRadius: '0.75rem',
              padding: '0.5rem 0.9rem',
              color: '#4f46e5',
              borderColor: '#c7d2fe',
              background: '#eef2ff'
            }}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginBottom: '1.5rem',
      }}>
        {[
          { id: 'all', label: `All (${notifications.length})` },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'job_update', label: `Bookings` },
          { id: 'chat_message', label: `Support Replies` },
        ].map(tab => {
          const active = filterType === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: active ? '1.5px solid #4f46e5' : '1.5px solid #e5e7eb',
                background: active ? '#4f46e5' : '#ffffff',
                color: active ? '#ffffff' : '#4b5563',
                fontWeight: active ? 700 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: active ? '0 2px 6px rgba(79, 70, 229, 0.25)' : 'none'
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', opacity: 0.6 }}>
              <div style={{ height: 18, width: '40%', background: '#f3f4f6', borderRadius: 8, marginBottom: '0.5rem' }} />
              <div style={{ height: 14, width: '70%', background: '#f3f4f6', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '1.25rem',
          border: '1px solid #e5e7eb',
          padding: '4rem 2rem',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: '#9ca3af'
          }}>
            <Bell size={28} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e1b4b', margin: '0 0 0.4rem' }}>
            No notifications found
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            {filterType === 'unread' ? "You're all caught up! No unread messages." : "You have no notifications in this category yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filteredNotifications.map(notif => {
            const styleInfo = getIconAndStyle(notif.type)
            const isUnread = !notif.is_read

            return (
              <div
                key={notif.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1.125rem 1.25rem',
                  background: isUnread ? '#f8faff' : '#ffffff',
                  borderRadius: '1rem',
                  border: isUnread ? '1.5px solid #c7d2fe' : '1px solid #e5e7eb',
                  boxShadow: isUnread ? '0 4px 14px rgba(79, 70, 229, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                  <div style={{
                    width: 44,
                    height: 44,
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.375rem',
                        background: styleInfo.badgeBg,
                        color: styleInfo.badgeColor
                      }}>
                        {styleInfo.badgeText}
                      </span>
                      
                      <h4 style={{
                        fontSize: '0.95rem',
                        fontWeight: isUnread ? 800 : 700,
                        color: '#1e1b4b',
                        margin: 0
                      }}>
                        {notif.title}
                      </h4>

                      {isUnread && (
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#4f46e5',
                          display: 'inline-block'
                        }} />
                      )}
                    </div>

                    <p style={{
                      margin: '0 0 0.625rem',
                      fontSize: '0.875rem',
                      color: isUnread ? '#374151' : '#6b7280',
                      lineHeight: 1.5
                    }}>
                      {notif.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                        <Clock size={12} /> {formatTimestamp(notif.created_at)}
                      </span>

                      {(notif.type === 'chat_message' || notif.type === 'booking_alert' || notif.type === 'job_update') && (
                        <button
                          onClick={() => handleAction(notif)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#4f46e5',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: 0
                          }}
                        >
                          {notif.type === 'chat_message' ? 'Open Chat' : 'View Booking'} <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {isUnread && (
                    <button
                      title="Mark as read"
                      onClick={() => markAsRead(notif.id)}
                      style={{
                        padding: '0.45rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        background: '#ffffff',
                        color: '#4f46e5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    title="Delete notification"
                    onClick={() => deleteNotification(notif.id)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '0.5rem',
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
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
