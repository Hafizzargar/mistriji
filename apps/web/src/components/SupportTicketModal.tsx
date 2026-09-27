import React, { useState, useEffect, useRef } from 'react'
import {
  X, Send, MessageCircle, PlusCircle, Bookmark, Ticket,
  Clock, AlertCircle, CheckCircle2, ChevronRight, ArrowLeft,
  LifeBuoy, Sparkles, Filter, RefreshCw, HardHat, User, Phone
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCustomerAuth } from '../contexts/CustomerAuthContext'
import {
  SupportTicket, TicketCategory, TicketPriority, TicketStatus,
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  generateTicketNumber, formatTicketPayload, formatTicketReply,
  formatTicketStatusUpdate, parseTicketsFromMessages,
  TICKET_PREFIX, TICKET_REPLY_PREFIX, TICKET_STATUS_PREFIX
} from '../lib/ticketService'

interface SupportTicketModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'tickets' | 'raise' | 'chat'
  forcedRole?: 'customer' | 'worker'
}

export function SupportTicketModal({ isOpen, onClose, initialTab = 'tickets', forcedRole }: SupportTicketModalProps) {
  const { customer } = useCustomerAuth()
  const activeRole: 'customer' | 'worker' = forcedRole || (customer?.role === 'worker' ? 'worker' : 'customer')

  const [view, setView] = useState<'tickets' | 'raise' | 'detail' | 'chat'>(initialTab)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Raise Ticket Form State
  const [category, setCategory] = useState<TicketCategory>(
    activeRole === 'worker' ? 'payment_payout' : 'service_quality'
  )
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [jobId, setJobId] = useState<string>('')
  const [userJobs, setUserJobs] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Reply State inside Ticket Detail
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Direct Chat State
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  // Status Filter in Tickets list
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setView(initialTab)
    }
  }, [isOpen, initialTab])

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Fetch messages and parse tickets
  const fetchAllMessages = async () => {
    if (!customer?.id) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        // Parse structured tickets
        const parsed = parseTicketsFromMessages(data)
        setTickets(parsed)

        // Include all messages in direct chat stream so tickets raised appear inline in chat
        const allChat = data.filter(m => !m.is_archived_by_user)
        setChatMessages(allChat)

        // Mark unread admin messages as read
        const unread = data.filter(m => m.sender === 'admin' && !m.is_read)
        if (unread.length > 0) {
          const ids = unread.map(m => m.id)
          await supabase.from('support_messages').update({ is_read: true }).in('id', ids)
        }

        // Clean up chat notifications
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', customer.id)
          .eq('type', 'chat_message')
          .eq('is_read', false)
      }
    } catch (e) {
      console.error('Error fetching support messages:', e)
    } finally {
      setLoading(false)
    }
  }

  // Fetch user jobs for ticket association
  useEffect(() => {
    if (!isOpen || !customer?.id) return
    const fetchJobs = async () => {
      try {
        const query = supabase.from('jobs').select('id, area, status, created_at, skills(name, icon)')
        if (activeRole === 'worker') {
          query.eq('worker_id', customer.id)
        } else {
          query.eq('customer_id', customer.id)
        }
        const { data } = await query.order('created_at', { ascending: false }).limit(10)
        if (data) setUserJobs(data)
      } catch (e) {}
    }
    fetchJobs()
  }, [isOpen, customer?.id, activeRole])

  useEffect(() => {
    if (!isOpen || !customer?.id) return
    fetchAllMessages()

    const channel = supabase
      .channel(`support_tickets_${customer.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `user_id=eq.${customer.id}`
      }, () => {
        fetchAllMessages()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_messages',
        filter: `user_id=eq.${customer.id}`
      }, () => {
        fetchAllMessages()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, customer?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [view, selectedTicketId, tickets, chatMessages])

  // Handle Raise Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer?.id || !subject.trim() || !description.trim()) return

    if (tickets.some(t => t.status === 'open' || t.status === 'in_progress')) {
      alert('You already have an active ticket.')
      return
    }

    setSubmitting(true)
    const ticketId = generateTicketNumber()
    const payload = formatTicketPayload({
      ticketId,
      category,
      priority,
      status: 'open',
      subject: subject.trim(),
      userRole: activeRole,
      userName: customer.name || (activeRole === 'worker' ? 'Technician' : 'Customer'),
      userPhone: customer.phone || '',
      jobId: jobId || undefined,
      description: description.trim(),
    })

    const newMsg = {
      user_id: customer.id,
      sender: 'user',
      content: payload,
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    setSubmitting(false)

    if (!error) {
      setSubject('')
      setDescription('')
      setJobId('')
      setSelectedTicketId(ticketId)
      setView('detail')
      fetchAllMessages()
    }
  }

  // Handle Reply to Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer?.id || !selectedTicketId || !replyText.trim()) return

    setSendingReply(true)
    const payload = formatTicketReply(selectedTicketId, replyText.trim())

    const newMsg = {
      user_id: customer.id,
      sender: 'user',
      content: payload,
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    setSendingReply(false)

    if (!error) {
      setReplyText('')
      fetchAllMessages()
    }
  }

  // Handle User resolving their ticket
  const handleToggleResolve = async (ticket: SupportTicket) => {
    if (!customer?.id) return
    const nextStatus = ticket.status === 'resolved' ? 'open' : 'resolved'
    const payload = formatTicketStatusUpdate(ticket.id, nextStatus, `User marked ticket as ${nextStatus}`)

    await supabase.from('support_messages').insert({
      user_id: customer.id,
      sender: 'user',
      content: payload,
      is_read: false,
    })
    fetchAllMessages()
  }

  // Handle Direct Chat Send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer?.id || !chatInput.trim()) return

    setSendingChat(true)
    const newMsg = {
      user_id: customer.id,
      sender: 'user',
      content: chatInput.trim(),
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    setSendingChat(false)

    if (!error) {
      setChatInput('')
      fetchAllMessages()
    }
  }

  const renderWebChatMessageContent = (content: string, isMe: boolean) => {
    if (content.startsWith(TICKET_PREFIX)) {
      try {
        const closeIdx = content.indexOf(']')
        if (closeIdx !== -1) {
          const ticketId = content.substring(TICKET_PREFIX.length, closeIdx).trim()
          const rest = content.substring(closeIdx + 1).trim()
          const firstLineEnd = rest.indexOf('\n\n')
          const metaStr = firstLineEnd !== -1 ? rest.substring(0, firstLineEnd) : rest
          const desc = firstLineEnd !== -1 ? rest.substring(firstLineEnd + 2) : ''
          const meta = JSON.parse(metaStr)
          const categoryInfo = TICKET_CATEGORIES[meta.cat as TicketCategory] || { label: meta.cat || 'General Inquiry', emoji: '🎫' }
          const priorityInfo = TICKET_PRIORITIES[meta.pri as TicketPriority] || { label: meta.pri || 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
          const statusInfo = TICKET_STATUSES[meta.st as TicketStatus] || { label: meta.st || 'Open', emoji: '🟡', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }

          return (
            <div style={{
              background: '#ffffff',
              borderRadius: '0.875rem',
              border: '2px solid #818cf8',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.12)',
              color: '#0f172a',
              minWidth: '260px',
              maxWidth: '360px',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Ticket size={16} /> #{ticketId || meta.ticketId}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 99,
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  border: `1px solid ${statusInfo.border}`,
                }}>
                  {statusInfo.emoji} {statusInfo.label}
                </span>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                {meta.sub}
              </div>

              {desc && (
                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.45, marginBottom: '0.65rem', whiteSpace: 'pre-wrap' }}>
                  {desc}
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.5rem',
                fontSize: '0.72rem',
                color: '#64748b',
              }}>
                <span>{categoryInfo.emoji} {categoryInfo.label}</span>
                <span style={{
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.25rem',
                  background: priorityInfo.bg,
                  color: priorityInfo.color,
                  border: `1px solid ${priorityInfo.border}`,
                }}>
                  {priorityInfo.label}
                </span>
              </div>
            </div>
          )
        }
      } catch (e) {
        console.error('Error rendering web ticket card:', e)
      }
    }

    if (content.startsWith(TICKET_REPLY_PREFIX)) {
      const closeIdx = content.indexOf(']')
      if (closeIdx !== -1) {
        const tktId = content.substring(TICKET_REPLY_PREFIX.length, closeIdx).trim()
        const replyBody = content.substring(closeIdx + 1).trim()
        return (
          <div>
            <div style={{ fontSize: '0.7rem', color: isMe ? 'rgba(255,255,255,0.85)' : '#6366f1', fontWeight: 700, marginBottom: '0.2rem' }}>
              Replying to #{tktId}:
            </div>
            <div>{replyBody}</div>
          </div>
        )
      }
    }

    if (content.startsWith(TICKET_STATUS_PREFIX)) {
      try {
        const closeIdx = content.indexOf(']')
        if (closeIdx !== -1) {
          const tktId = content.substring(TICKET_STATUS_PREFIX.length, closeIdx).trim()
          const metaStr = content.substring(closeIdx + 1).trim()
          const meta = JSON.parse(metaStr)
          const status = (meta.status || 'updated') as TicketStatus
          const note = meta.note || ''
          const statusInfo = TICKET_STATUSES[status] || { label: status, emoji: '⚡', color: '#0f172a', bg: '#f8fafc', border: '#cbd5e1' }

          return (
            <div style={{
              background: statusInfo.bg,
              border: `1px solid ${statusInfo.border}`,
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              color: statusInfo.color,
              textAlign: 'center',
              fontWeight: 600,
            }}>
              ⚡ Support Ticket #{tktId} status changed to <strong>{statusInfo.label.toUpperCase()}</strong>
              {note && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>{note}</div>}
            </div>
          )
        }
      } catch (e) {
        console.error('Error rendering web status update:', e)
      }
    }

    return <div>{content}</div>
  }

  if (!isOpen) return null

  const selectedTicket = tickets.find(t => t.id === selectedTicketId)
  const filteredTickets = tickets.filter(t => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'open') return t.status === 'open' || t.status === 'in_progress'
    if (statusFilter === 'in_progress') return t.status === 'in_progress'
    if (statusFilter === 'resolved') return t.status === 'resolved' || t.status === 'closed'
    return true
  })

  // Enforce one active ticket rule
  const hasActiveTicket = tickets.some(t => t.status === 'open' || t.status === 'in_progress') || loading

  // Filter available categories for current role
  const categoryOptions = (Object.keys(TICKET_CATEGORIES) as TicketCategory[]).filter(k =>
    TICKET_CATEGORIES[k].roles.includes(activeRole)
  )

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
    }}>
      <div
        ref={modalRef}
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 580,
          height: '92vh',
          maxHeight: 680,
          borderRadius: '1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {view === 'detail' && (
              <button
                onClick={() => setView('tickets')}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#fff',
                  width: 32,
                  height: 32,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginRight: '0.25rem',
                }}
                title="Back to Tickets"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '0.625rem',
              background: activeRole === 'worker' ? '#0284c7' : '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {activeRole === 'worker' ? <HardHat size={20} color="#fff" /> : <LifeBuoy size={20} color="#fff" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
                  MistriJi Helpdesk & Support
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: activeRole === 'worker' ? '#0369a1' : '#4338ca',
                  color: '#e0f2fe',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 99,
                }}>
                  {activeRole === 'worker' ? 'Technician Portal' : 'Customer Portal'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                {view === 'detail' ? `Ticket #${selectedTicket?.id}` : 'Raise tickets, track status, and chat with admin'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#cbd5e1',
              width: 32,
              height: 32,
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs (Hidden in detail view) */}
        {view !== 'detail' && (
          <div style={{
            display: 'flex',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.35rem 0.75rem',
            gap: '0.5rem',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setView('tickets')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: view === 'tickets' ? '#ffffff' : 'transparent',
                color: view === 'tickets' ? '#0f172a' : '#64748b',
                boxShadow: view === 'tickets' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Ticket size={15} color={view === 'tickets' ? '#4f46e5' : '#64748b'} />
              My Tickets ({tickets.length})
            </button>

            <button
              onClick={() => setView('raise')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: view === 'raise' ? '#ffffff' : 'transparent',
                color: view === 'raise' ? '#059669' : '#64748b',
                boxShadow: view === 'raise' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <PlusCircle size={15} color={view === 'raise' ? '#059669' : '#64748b'} />
              Raise Ticket
            </button>

            <button
              onClick={() => setView('chat')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: view === 'chat' ? '#ffffff' : 'transparent',
                color: view === 'chat' ? '#2563eb' : '#64748b',
                boxShadow: view === 'chat' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <MessageCircle size={15} color={view === 'chat' ? '#2563eb' : '#64748b'} />
              Live Chat
            </button>
          </div>
        )}

        {/* View 1: My Tickets List */}
        {view === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#f8fafc' }}>
            {/* Filter Pills */}
            <div style={{
              display: 'flex',
              gap: '0.35rem',
              padding: '0.75rem 1rem 0.25rem 1rem',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              {(['all', 'open', 'in_progress', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 99,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: statusFilter === f ? '#0f172a' : '#e2e8f0',
                    background: statusFilter === f ? '#0f172a' : '#ffffff',
                    color: statusFilter === f ? '#ffffff' : '#64748b',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f === 'all' && `All (${tickets.length})`}
                  {f === 'open' && `Open (${tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length})`}
                  {f === 'in_progress' && `In Progress (${tickets.filter(t => t.status === 'in_progress').length})`}
                  {f === 'resolved' && `Resolved (${tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length})`}
                </button>
              ))}
            </div>

            {/* List Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <RefreshCw size={18} className="animate-spin" /> Loading your tickets…
                </div>
              ) : filteredTickets.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '2rem 1rem',
                }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                    <Ticket size={28} />
                  </div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>
                    {statusFilter === 'all' ? 'No Support Tickets Found' : `No ${statusFilter} tickets`}
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.8rem', maxWidth: 280 }}>
                    Need assistance with a booking, payment issue, or general support? Raise a new ticket below.
                  </p>
                  <button
                    onClick={() => setView('raise')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      padding: '0.55rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <PlusCircle size={15} /> Raise New Ticket
                  </button>
                </div>
              ) : (
                filteredTickets.map(t => {
                  const pri = TICKET_PRIORITIES[t.priority] || TICKET_PRIORITIES.medium
                  const st = TICKET_STATUSES[t.status] || TICKET_STATUSES.open
                  const cat = TICKET_CATEGORIES[t.category]
                  const lastMsg = t.messages[t.messages.length - 1]

                  return (
                    <div
                      key={t.id}
                      onClick={() => { setSelectedTicketId(t.id); setView('detail') }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                            #{t.id}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                            {cat?.emoji} {cat?.label || t.categoryLabel}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.5rem',
                            borderRadius: 99,
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                          }}>
                            {st.emoji} {st.label}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                        {t.subject}
                      </div>

                      {lastMsg && (
                        <div style={{
                          fontSize: '0.78rem',
                          color: '#64748b',
                          background: '#f8fafc',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: lastMsg.sender === 'admin' ? '#4f46e5' : '#0f172a' }}>
                              {lastMsg.sender === 'admin' ? '🛡️ Admin: ' : 'You: '}
                            </strong>
                            {lastMsg.content}
                          </span>
                          <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
                        <span>Created: {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ color: pri.color, fontWeight: 700 }}>Priority: {pri.label}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* View 2: Raise Ticket Form */}
        {view === 'raise' && (
          hasActiveTicket ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.25rem' }}>Active Ticket Exists</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: 320 }}>
                You already have an open support ticket. Please wait for it to be resolved or closed by our team before raising a new one.
              </p>
              <button 
                onClick={() => setView('tickets')}
                style={{
                  background: '#4f46e5', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <Ticket size={16} />
                View My Active Ticket
              </button>
            </div>
          ) : (
          <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{
                background: activeRole === 'worker' ? '#f0f9ff' : '#eff6ff',
                border: `1px solid ${activeRole === 'worker' ? '#bae6fd' : '#bfdbfe'}`,
                padding: '0.75rem 1rem',
                borderRadius: '0.625rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: activeRole === 'worker' ? '#0369a1' : '#1e40af',
              }}>
                <Sparkles size={16} />
                <span>
                  Raising as <strong>{activeRole === 'worker' ? '👷 Technician' : '👤 Customer'}</strong> ({customer?.name || customer?.phone}). Our support team typically responds within 15 minutes.
                </span>
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Issue Category *</label>
                <select
                  className="input"
                  value={category}
                  onChange={e => setCategory(e.target.value as TicketCategory)}
                  required
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>
                      {TICKET_CATEGORIES[cat].emoji} {TICKET_CATEGORIES[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Priority Level</label>
                  <select
                    className="input"
                    value={priority}
                    onChange={e => setPriority(e.target.value as TicketPriority)}
                  >
                    <option value="low">🟢 Low (General inquiry)</option>
                    <option value="medium">🟡 Medium (Standard issue)</option>
                    <option value="high">🟠 High (Job delayed / Payment)</option>
                    <option value="urgent">🔴 Urgent (Emergency / On-site dispute)</option>
                  </select>
                </div>

                <div>
                  <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Related Booking (Optional)</label>
                  <select
                    className="input"
                    value={jobId}
                    onChange={e => setJobId(e.target.value)}
                  >
                    <option value="">-- None / General --</option>
                    {userJobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.skills?.icon || '🔧'} {j.skills?.name || 'Job'} (#{j.id.slice(0, 6)}) • {j.area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Subject / Problem Summary *</label>
                <input
                  className="input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder={activeRole === 'worker' ? "e.g. Dihaadi payment delay for Gandhi Nagar electrical job" : "e.g. Technician arrived late / incorrect service charged"}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Detailed Description *</label>
                <textarea
                  className="input"
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Please describe the issue in detail including any relevant dates, times, or transaction details…"
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>
            </div>

            <div style={{
              padding: '0.875rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              flexShrink: 0,
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setView('tickets')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                {submitting ? 'Creating Ticket…' : 'Submit Support Ticket'}
              </button>
            </div>
          </form>
          )
        )}

        {/* View 3: Ticket Detail & Message Thread */}
        {view === 'detail' && selectedTicket && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#f8fafc' }}>
            {/* Ticket Info Card */}
            <div style={{
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              padding: '0.875rem 1.25rem',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                      #{selectedTicket.id}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                      {selectedTicket.categoryLabel}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 99,
                      background: TICKET_STATUSES[selectedTicket.status]?.bg,
                      color: TICKET_STATUSES[selectedTicket.status]?.color,
                      border: `1px solid ${TICKET_STATUSES[selectedTicket.status]?.border}`,
                    }}>
                      {TICKET_STATUSES[selectedTicket.status]?.emoji} {TICKET_STATUSES[selectedTicket.status]?.label}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                    {selectedTicket.subject}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleResolve(selectedTicket)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedTicket.status === 'resolved' ? '#fde68a' : '#bbf7d0',
                    background: selectedTicket.status === 'resolved' ? '#fffbeb' : '#f0fdf4',
                    color: selectedTicket.status === 'resolved' ? '#b45309' : '#15803d',
                  }}
                  title={selectedTicket.status === 'resolved' ? 'Re-open this ticket' : 'Mark issue as resolved'}
                >
                  <CheckCircle2 size={13} />
                  {selectedTicket.status === 'resolved' ? 'Re-open Ticket' : 'Mark Resolved'}
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              {selectedTicket.messages.map((m, idx) => {
                const isMe = m.sender === 'user'
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#64748b',
                      marginBottom: '0.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}>
                      {isMe ? 'You' : '🛡️ MistriJi Admin Support'}
                    </div>

                    <div style={{
                      maxWidth: '82%',
                      padding: '0.75rem 1rem',
                      borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                      background: isMe ? '#4f46e5' : '#ffffff',
                      color: isMe ? '#ffffff' : '#1e293b',
                      fontSize: '0.85rem',
                      lineHeight: 1.45,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                      border: isMe ? 'none' : '1px solid #e2e8f0',
                      wordBreak: 'break-word',
                    }}>
                      {m.content}
                    </div>

                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <form
              onSubmit={handleSendReply}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <input
                className="input"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply to support…"
                style={{ flex: 1 }}
                disabled={sendingReply}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sendingReply || !replyText.trim()}
                style={{ height: 42, padding: '0 1rem' }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* View 4: Direct Live Chat */}
        {view === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#f8fafc' }}>
            <div style={{
              padding: '0.75rem 1rem',
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              fontSize: '0.75rem',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0,
            }}>
              <MessageCircle size={15} />
              <span>Direct live chat channel with MistriJi operations desk.</span>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', fontSize: '0.85rem' }}>
                  No previous direct messages. Send a message below to start a live support conversation.
                </div>
              ) : (
                chatMessages.map(m => {
                  const isMe = m.sender === 'user'
                  const isTicketPayload = m.content.startsWith('[TICKET:')
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isTicketPayload ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                        width: '100%'
                      }}
                    >
                      <div style={{
                        maxWidth: isTicketPayload ? '92%' : '80%',
                        padding: isTicketPayload ? '0' : '0.75rem 1rem',
                        borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                        background: isTicketPayload ? 'transparent' : (isMe ? '#4f46e5' : '#ffffff'),
                        color: isMe ? '#ffffff' : '#1e293b',
                        fontSize: '0.85rem',
                        lineHeight: 1.45,
                        boxShadow: isTicketPayload ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
                        border: isTicketPayload || isMe ? 'none' : '1px solid #e2e8f0',
                      }}>
                        {renderWebChatMessageContent(m.content, isMe)}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <input
                className="input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message to support…"
                style={{ flex: 1 }}
                disabled={sendingChat}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sendingChat || !chatInput.trim()}
                style={{ height: 42, padding: '0 1rem' }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
