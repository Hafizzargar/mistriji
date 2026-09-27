import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle, Send, User as UserIcon, Phone, Search, Plus, X,
  Bookmark, ArchiveX, Ticket, HardHat, CheckCircle2, Clock,
  AlertTriangle, Filter, Sparkles, RefreshCw, ChevronRight, Check,
  LifeBuoy, Mail, ArrowUpRight, Share2, Copy, PlusCircle, ExternalLink,
  CheckCheck, Eye, Zap, Flame, ShieldAlert, ChevronDown
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { logAdminAction } from '@/lib/auditLogger'
import { useToast } from '@/contexts/ToastContext'
import {
  SupportTicket, TicketCategory, TicketPriority, TicketStatus,
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  parseTicketsFromMessages, formatTicketReply, formatTicketStatusUpdate,
  generateTicketNumber, formatTicketPayload,
  TICKET_PREFIX, TICKET_REPLY_PREFIX, TICKET_STATUS_PREFIX
} from '@/lib/ticketService'

interface RawMessage {
  id: string
  user_id: string
  sender: 'user' | 'admin'
  content: string
  created_at: string
  is_read: boolean
  is_bookmarked?: boolean
  is_archived_by_admin?: boolean
  users?: {
    id: string
    phone: string
    email: string | null
    role: string
    profiles: { name: string } | null
  }
}

interface DirectConversation {
  user_id: string
  user_name: string
  user_phone: string
  user_email: string
  role: string
  last_message: RawMessage
  unread_count: number
  messages: RawMessage[]
}

const QUICK_REPLIES = [
  "👋 Hello! We are checking your issue now.",
  "✅ Verified and processed by admin.",
  "💳 Payment / Payout released successfully.",
  "👷 Technician re-assigned to your booking.",
  "📸 Please share photo / details if possible.",
  "🎉 Issue resolved. Thank you!"
]

export function SupportInboxPage() {
  const { user: adminUser } = useAuth()
  const toast = useToast()

  // Top-level active tab: 'direct_chat' (default) | 'tickets'
  const [activeTab, setActiveTab] = useState<'direct_chat' | 'tickets'>('direct_chat')

  // Raw data from DB
  const [allMessages, setAllMessages] = useState<RawMessage[]>([])
  const [loading, setLoading] = useState(true)

  // ── Ticket State ──────────────────────────────────────────
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [ticketSearch, setTicketSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'worker'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all')
  const [ticketReplyText, setTicketReplyText] = useState('')
  const [sendingTicketReply, setSendingTicketReply] = useState(false)

  // ── Admin Raise Ticket State ──────────────────────────────
  const [showRaiseModal, setShowRaiseModal] = useState(false)
  const [targetUser, setTargetUser] = useState<any | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [adminCategory, setAdminCategory] = useState<TicketCategory>('general_inquiry')
  const [adminPriority, setAdminPriority] = useState<TicketPriority>('medium')
  const [adminSubject, setAdminSubject] = useState('')
  const [adminDescription, setAdminDescription] = useState('')
  const [adminJobId, setAdminJobId] = useState('')
  const [userJobs, setUserJobs] = useState<any[]>([])
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [showInlineTicketForm, setShowInlineTicketForm] = useState(false)

  // ── Direct Chat State ─────────────────────────────────────
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [directInputText, setDirectInputText] = useState('')
  const [directSearch, setDirectSearch] = useState('')
  const [directRoleFilter, setDirectRoleFilter] = useState<'all' | 'customer' | 'worker'>('all')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [newChatResults, setNewChatResults] = useState<any[]>([])
  const [searchingNewChatUsers, setSearchingNewChatUsers] = useState(false)

  // Presence sync for online/offline indicator
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const presenceChannel = supabase.channel('global_user_presence')

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const ids = new Set<string>()
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) ids.add(p.user_id)
          })
        })
        setOnlineUserIds(ids)
      })
      .on('presence', { event: 'join' }, ({ newPresences }: any) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev)
          newPresences.forEach((p: any) => { if (p.user_id) next.add(p.user_id) })
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev)
          leftPresences.forEach((p: any) => { if (p.user_id) next.delete(p.user_id) })
          return next
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [])

  // Fetch all support messages from DB
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`
        *,
        users (
          id, phone, email, role,
          profiles (name)
        )
      `)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      toast.error('Failed to load support messages: ' + error.message)
      setLoading(false)
      return
    }

    const msgs = ((data as any[]) || []).filter(m => !m.is_archived_by_admin)
    setAllMessages(msgs)

    // Build direct conversations map
    const convMap = new Map<string, DirectConversation>()
    msgs.forEach(msg => {
      const uid = msg.user_id
      if (!convMap.has(uid)) {
        const u = msg.users || {}
        const p = u.profiles || {}
        convMap.set(uid, {
          user_id: uid,
          user_name: p.name || (u.role === 'worker' ? 'Technician' : 'Customer'),
          user_phone: u.phone || 'No phone',
          user_email: u.email || '',
          role: u.role || 'customer',
          last_message: msg,
          unread_count: 0,
          messages: [],
        })
      }

      const conv = convMap.get(uid)!
      conv.messages.push(msg)
      conv.last_message = msg
      if (msg.sender === 'user' && !msg.is_read) {
        conv.unread_count++
      }
    })

    const sortedConvs = Array.from(convMap.values()).sort(
      (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    )
    setDirectConversations(sortedConvs)
    setLoading(false)
  }

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel('admin_support_inbox_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedTicketId, selectedUserId, allMessages, showInlineTicketForm])

  // Parse Tickets
  const parsedTickets = useMemo(() => {
    return parseTicketsFromMessages(allMessages)
  }, [allMessages])

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return parsedTickets.filter(t => {
      if (roleFilter !== 'all' && t.userRole !== roleFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false

      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase()
        const matchId = t.id.toLowerCase().includes(q)
        const matchName = t.userName.toLowerCase().includes(q)
        const matchPhone = t.userPhone.toLowerCase().includes(q)
        const matchSubject = t.subject.toLowerCase().includes(q)
        const matchCategory = t.categoryLabel.toLowerCase().includes(q)
        if (!matchId && !matchName && !matchPhone && !matchSubject && !matchCategory) {
          return false
        }
      }

      return true
    })
  }, [parsedTickets, roleFilter, statusFilter, ticketSearch])

  // Filtered Direct Conversations
  const filteredConversations = useMemo(() => {
    return directConversations.filter(c => {
      if (directRoleFilter !== 'all' && c.role !== directRoleFilter) return false
      if (directSearch.trim()) {
        const q = directSearch.toLowerCase()
        const matchName = c.user_name.toLowerCase().includes(q)
        const matchPhone = c.user_phone.toLowerCase().includes(q)
        const matchEmail = c.user_email.toLowerCase().includes(q)
        const matchLastMsg = c.last_message?.content?.toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchEmail && !matchLastMsg) return false
      }
      return true
    })
  }, [directConversations, directRoleFilter, directSearch])

  // Default selected ticket
  useEffect(() => {
    if (activeTab === 'tickets' && !selectedTicketId && filteredTickets.length > 0) {
      setSelectedTicketId(filteredTickets[0].id)
    }
  }, [activeTab, selectedTicketId, filteredTickets])

  // Default selected direct chat
  useEffect(() => {
    if (!selectedUserId && filteredConversations.length > 0) {
      setSelectedUserId(filteredConversations[0].user_id)
    }
  }, [selectedUserId, filteredConversations])

  const selectedTicket = parsedTickets.find(t => t.id === selectedTicketId)
  const selectedConversation = directConversations.find(c => c.user_id === selectedUserId)

  // Mark ticket messages as read when viewing
  useEffect(() => {
    if (!selectedTicketId || !selectedTicket) return
    const unreadMsgs = selectedTicket.messages.filter(m => m.sender === 'user' && !m.isRead)
    if (unreadMsgs.length > 0) {
      const ids = unreadMsgs.map(m => m.id)
      supabase.from('support_messages').update({ is_read: true }).in('id', ids).then()
    }
  }, [selectedTicketId, selectedTicket])

  // Fetch jobs for target user when raising ticket
  useEffect(() => {
    if (!targetUser?.id) {
      setUserJobs([])
      return
    }
    const fetchUserJobs = async () => {
      const isWorker = targetUser.role === 'worker'
      const q = supabase.from('jobs').select('id, area, status, created_at, skills(name, icon)')
      if (isWorker) {
        q.eq('worker_id', targetUser.id)
      } else {
        q.eq('customer_id', targetUser.id)
      }
      const { data } = await q.order('created_at', { ascending: false }).limit(6)
      if (data) setUserJobs(data)
    }
    fetchUserJobs()
  }, [targetUser])

  // Search Target Users for Admin Ticket Creation Modal
  const handleSearchTargetUsers = async (q: string) => {
    setUserQuery(q)
    if (!q.trim()) {
      setUserResults([])
      return
    }
    setSearchingUsers(true)
    const { data } = await supabase
      .from('users')
      .select('id, phone, email, role, profiles(name, area)')
      .or(`phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)

    setUserResults(data || [])
    setSearchingUsers(false)
  }

  // Handle Admin Raise Ticket
  const handleAdminCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeTarget = targetUser || (selectedConversation ? {
      id: selectedConversation.user_id,
      phone: selectedConversation.user_phone,
      email: selectedConversation.user_email,
      role: selectedConversation.role,
      profiles: { name: selectedConversation.user_name }
    } : null)

    if (!activeTarget?.id || !adminSubject.trim() || !adminDescription.trim()) {
      toast.error('Please provide a subject and description for the ticket.')
      return
    }

    setCreatingTicket(true)
    const ticketId = generateTicketNumber()
    const userRole: 'customer' | 'worker' = activeTarget.role === 'worker' ? 'worker' : 'customer'
    const userName = activeTarget.profiles?.name || (userRole === 'worker' ? 'Technician' : 'Customer')
    const userPhone = activeTarget.phone || ''

    const payload = formatTicketPayload({
      ticketId,
      category: adminCategory,
      priority: adminPriority,
      status: 'open',
      subject: adminSubject.trim(),
      userRole,
      userName,
      userPhone,
      jobId: adminJobId || undefined,
      description: adminDescription.trim(),
    })

    const newMsg = {
      user_id: activeTarget.id,
      sender: 'admin',
      content: payload,
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    setCreatingTicket(false)

    if (!error) {
      try {
        await supabase.from('notifications').insert({
          user_id: activeTarget.id,
          title: `New Support Ticket: #${ticketId}`,
          message: `Support ticket #${ticketId} opened: "${adminSubject.trim()}"`,
          type: 'chat_message',
          reference_id: ticketId,
        })
      } catch (err) { }

      await logAdminAction({
        actor: adminUser,
        action: 'Support Ticket Created',
        targetType: 'support_ticket',
        targetId: ticketId,
        details: `created support ticket #${ticketId} ("${adminSubject.trim()}") for ${userName} (+91 ${userPhone})`,
      })

      toast.success(`Ticket #${ticketId} created & posted in chat!`)
      setShowRaiseModal(false)
      setShowInlineTicketForm(false)
      setTargetUser(null)
      setUserQuery('')
      setUserResults([])
      setAdminSubject('')
      setAdminDescription('')
      setAdminJobId('')
      setSelectedUserId(activeTarget.id)
      fetchMessages()
    } else {
      toast.error('Failed to create ticket: ' + error.message)
    }
  }

  // Handle Admin Ticket Reply
  const handleSendTicketReply = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault()
    const textToSend = (customText || ticketReplyText).trim()
    if (!selectedTicket || !textToSend) return

    setSendingTicketReply(true)
    const payload = formatTicketReply(selectedTicket.id, textToSend)

    const newMsg = {
      user_id: selectedTicket.userId,
      sender: 'admin',
      content: payload,
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    setSendingTicketReply(false)

    if (!error) {
      if (!customText) setTicketReplyText('')
      fetchMessages()

      try {
        await supabase.from('notifications').insert({
          user_id: selectedTicket.userId,
          title: `Support Reply #${selectedTicket.id}`,
          message: textToSend.substring(0, 100),
          type: 'chat_message',
          reference_id: selectedTicket.id,
        })
      } catch (err) { }
    } else {
      toast.error('Failed to send reply: ' + error.message)
    }
  }

  // Handle Share Ticket in Chat
  const handleShareTicketInChat = async (ticket: SupportTicket) => {
    const summaryCard = `🎫 OFFICIAL TICKET SUMMARY #${ticket.id}\n• Subject: ${ticket.subject}\n• Category: ${ticket.categoryLabel}\n• Priority: ${ticket.priority.toUpperCase()}\n• Status: ${ticket.status.toUpperCase()}\n\nThis ticket has been officially logged with MistriJi Admin Desk.`

    const payload = formatTicketReply(ticket.id, summaryCard)

    const { error } = await supabase.from('support_messages').insert({
      user_id: ticket.userId,
      sender: 'admin',
      content: payload,
      is_read: false,
    })

    if (error) {
      toast.error('Failed to share ticket: ' + error.message)
      return
    }

    toast.success(`Ticket #${ticket.id} summary posted into chat!`)
    fetchMessages()
  }

  // Handle Copy Ticket Details
  const handleCopyTicketInfo = (ticket: SupportTicket) => {
    const text = `MistriJi Support Ticket #${ticket.id}\nTopic: ${ticket.subject}\nStatus: ${ticket.status.toUpperCase()}\nUser: ${ticket.userName} (+91 ${ticket.userPhone})`
    navigator.clipboard.writeText(text)
    toast.success(`Copied Ticket #${ticket.id} info to clipboard!`)
  }

  // Handle Status Change
  const handleUpdateTicketStatus = async (status: TicketStatus) => {
    if (!selectedTicket) return
    const payload = formatTicketStatusUpdate(selectedTicket.id, status, `Admin updated status to ${status}`)

    const { error } = await supabase.from('support_messages').insert({
      user_id: selectedTicket.userId,
      sender: 'admin',
      content: payload,
      is_read: false,
    })

    if (error) {
      toast.error('Failed to update ticket status: ' + error.message)
      return
    }

    // Log admin action to audit_logs & push real-time notification to Super Admin
    await logAdminAction({
      actor: adminUser,
      action: status === 'closed' ? 'Support Ticket Closed' : (status === 'resolved' ? 'Support Ticket Resolved' : 'Support Ticket Status Updated'),
      targetType: 'support_ticket',
      targetId: selectedTicket.id,
      details: `${status === 'closed' ? 'closed' : `changed status to ${status.toUpperCase()} for`} support ticket #${selectedTicket.id} ("${selectedTicket.subject}") of ${selectedTicket.userName} (+91 ${selectedTicket.userPhone})`,
      oldValue: { status: selectedTicket.status },
      newValue: { status },
    })

    toast.success(`Ticket #${selectedTicket.id} marked as ${status.toUpperCase()} & Super Admin notified!`)
    fetchMessages()

    try {
      await supabase.from('notifications').insert({
        user_id: selectedTicket.userId,
        title: `Ticket #${selectedTicket.id} ${status.toUpperCase()}`,
        message: `Your support ticket status is now ${status.replace('_', ' ').toUpperCase()}`,
        type: 'job_update',
        reference_id: selectedTicket.id,
      })
    } catch (err) { }
  }

  // Quick action to close or resolve a ticket directly
  const handleQuickUpdateTicket = async (ticketId: string, userId: string, subject: string, newStatus: TicketStatus) => {
    const payload = formatTicketStatusUpdate(ticketId, newStatus, `Admin marked ticket as ${newStatus}`)

    const { error } = await supabase.from('support_messages').insert({
      user_id: userId,
      sender: 'admin',
      content: payload,
      is_read: false,
    })

    if (error) {
      toast.error('Failed to update ticket: ' + error.message)
      return
    }

    // Push audit log & Super Admin notification
    await logAdminAction({
      actor: adminUser,
      action: newStatus === 'closed' ? 'Support Ticket Closed' : 'Support Ticket Resolved',
      targetType: 'support_ticket',
      targetId: ticketId,
      details: `${newStatus === 'closed' ? 'closed' : 'resolved'} support ticket #${ticketId} ("${subject}")`,
      newValue: { status: newStatus },
    })

    toast.success(`Ticket #${ticketId} ${newStatus.toUpperCase()}! Super Admin notified.`)
    fetchMessages()
  }

  // Handle Direct Chat Send
  const handleSendDirectMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault()
    const textToSend = (customMsg || directInputText).trim()
    if (!selectedUserId || !textToSend) return

    const newMsg = {
      user_id: selectedUserId,
      sender: 'admin',
      content: textToSend,
      is_read: false,
    }

    const { error } = await supabase.from('support_messages').insert(newMsg)
    if (error) {
      toast.error('Failed to send message: ' + error.message)
      return
    }

    if (!customMsg) setDirectInputText('')
    fetchMessages()

    try {
      await supabase.from('notifications').insert({
        user_id: selectedUserId,
        title: 'New Support Message',
        message: textToSend.substring(0, 80),
        type: 'chat_message',
      })
    } catch (err) { }
  }

  // Search Users for New Chat
  const handleSearchNewChatUsers = async (q: string) => {
    setNewChatQuery(q)
    if (!q.trim()) {
      setNewChatResults([])
      return
    }
    setSearchingNewChatUsers(true)
    const { data } = await supabase
      .from('users')
      .select('id, phone, email, role, profiles(name, area)')
      .or(`phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)

    setNewChatResults(data || [])
    setSearchingNewChatUsers(false)
  }

  // Convert Direct Chat user to Ticket (Inline inside chat)
  const handleToggleInlineTicket = () => {
    if (!selectedConversation) return
    setTargetUser({
      id: selectedConversation.user_id,
      phone: selectedConversation.user_phone,
      email: selectedConversation.user_email,
      role: selectedConversation.role,
      profiles: { name: selectedConversation.user_name }
    })
    setAdminSubject(`Support Request - ${selectedConversation.user_name}`)
    setAdminDescription(selectedConversation.last_message?.content?.startsWith('[') ? '' : (selectedConversation.last_message?.content || ''))
    setShowInlineTicketForm(prev => !prev)
  }

  // Helper: jump from chat directly into full Ticket Desk view
  const handleOpenTicketInDesk = (tktId: string) => {
    setSelectedTicketId(tktId)
    setActiveTab('tickets')
  }

  // Render rich In-Chat Bubble content
  const renderChatMessageBubbleContent = (content: string, isAdmin: boolean) => {
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
          const categoryInfo = TICKET_CATEGORIES[meta.cat as TicketCategory] || { label: meta.cat || 'General', emoji: '🎫' }
          const priorityInfo = TICKET_PRIORITIES[meta.pri as TicketPriority] || { label: meta.pri || 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
          const statusInfo = TICKET_STATUSES[meta.st as TicketStatus] || { label: meta.st || 'Open', emoji: '🟡', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }

          return (
            <div style={{
              background: '#ffffff',
              borderRadius: '0.625rem',
              border: '1.5px solid #6366f1',
              padding: '0.65rem 0.75rem',
              boxShadow: '0 3px 10px rgba(99, 102, 241, 0.12)',
              color: '#0f172a',
              width: '100%',
              maxWidth: '340px',
              boxSizing: 'border-box',
              textAlign: 'left',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', gap: '0.4rem' }}>
                <span style={{
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <Ticket size={11} /> #{ticketId || meta.ticketId}
                </span>

                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: 99,
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  border: `1px solid ${statusInfo.border}`,
                }}>
                  {statusInfo.emoji} {statusInfo.label}
                </span>
              </div>

              {/* Subject */}
              <div style={{ fontWeight: 800, fontSize: '0.825rem', color: '#0f172a', marginBottom: '0.2rem', lineHeight: 1.25 }}>
                {meta.sub}
              </div>

              {/* Description */}
              {desc && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: 1.35,
                  marginBottom: '0.35rem',
                  whiteSpace: 'pre-wrap',
                  background: '#f8fafc',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.3rem',
                  border: '1px solid #e2e8f0',
                }}>
                  {desc}
                </div>
              )}

              {/* Footer & Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.45rem',
                fontSize: '0.7rem',
                color: '#64748b',
                flexWrap: 'wrap',
                gap: '0.35rem',
              }}>
                <span>{categoryInfo.emoji} {categoryInfo.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {meta.st !== 'closed' && meta.st !== 'resolved' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleQuickUpdateTicket(ticketId || meta.ticketId, selectedConversation?.user_id || '', meta.sub, 'resolved')}
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#059669',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '0.3rem',
                          cursor: 'pointer',
                        }}
                        title="Resolve Ticket"
                      >
                        Resolve ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickUpdateTicket(ticketId || meta.ticketId, selectedConversation?.user_id || '', meta.sub, 'closed')}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '0.3rem',
                          cursor: 'pointer',
                        }}
                        title="Close Ticket"
                      >
                        Close ✕
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenTicketInDesk(ticketId || meta.ticketId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      color: '#4338ca',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.3rem',
                      cursor: 'pointer',
                    }}
                  >
                    Desk View <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            </div>
          )
        }
      } catch (e) {
        console.error('Error rendering ticket card:', e)
      }
    }

    if (content.startsWith(TICKET_REPLY_PREFIX)) {
      const closeIdx = content.indexOf(']')
      if (closeIdx !== -1) {
        const tktId = content.substring(TICKET_REPLY_PREFIX.length, closeIdx).trim()
        const replyBody = content.substring(closeIdx + 1).trim()
        return (
          <div>
            <div style={{
              fontSize: '0.68rem',
              color: isAdmin ? 'rgba(255,255,255,0.9)' : '#6366f1',
              fontWeight: 800,
              marginBottom: '0.2rem',
            }}>
              Replying to #{tktId}:
            </div>
            <div style={{ lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{replyBody}</div>
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
              padding: '0.45rem 0.75rem',
              fontSize: '0.75rem',
              color: statusInfo.color,
              textAlign: 'center',
              fontWeight: 600,
              width: '100%',
              maxWidth: '380px',
              boxSizing: 'border-box',
            }}>
              <span>{statusInfo.emoji} Ticket #{tktId} status changed to <strong>{statusInfo.label.toUpperCase()}</strong></span>
              {note && <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>{note}</div>}
            </div>
          )
        }
      } catch (e) {
        console.error('Error rendering status update:', e)
      }
    }

    return <div style={{ lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>
  }

  const totalUnreadMessages = directConversations.reduce((acc, c) => acc + c.unread_count, 0)

  return (
    <div style={{
      height: 'calc(100vh - 105px)',
      maxHeight: 'calc(100vh - 105px)',
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* ── Standard Clean Page Header (Ultra-Compact) ─────────────── */}
      <div className="page-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.4rem',
        marginBottom: '0.4rem',
        flexShrink: 0,
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>Support & Ticket Desk</h1>
          <p className="page-subtitle" style={{ fontSize: '0.75rem', margin: '0.1rem 0 0 0', color: '#64748b' }}>Live chat support, instant ticket creation, and customer inquiry management</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {/* Quick Tab Switcher */}
          <div style={{
            display: 'flex',
            background: '#e2e8f0',
            padding: '0.15rem',
            borderRadius: '0.4rem',
            gap: '0.15rem',
          }}>
            <button
              onClick={() => setActiveTab('direct_chat')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '0.3rem',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                height: 30,
                cursor: 'pointer',
                background: activeTab === 'direct_chat' ? '#ffffff' : 'transparent',
                color: activeTab === 'direct_chat' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'direct_chat' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <MessageCircle size={13} color={activeTab === 'direct_chat' ? '#2563eb' : '#64748b'} />
              Direct Messages
              {totalUnreadMessages > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  padding: '0.02rem 0.35rem',
                  borderRadius: 99,
                  fontWeight: 800,
                }}>
                  {totalUnreadMessages}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '0.3rem',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                height: 30,
                cursor: 'pointer',
                background: activeTab === 'tickets' ? '#ffffff' : 'transparent',
                color: activeTab === 'tickets' ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === 'tickets' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <Ticket size={13} color={activeTab === 'tickets' ? '#4f46e5' : '#64748b'} />
              Support Tickets ({parsedTickets.length})
            </button>
          </div>

          {/* Raise Ticket Button */}
          <button
            onClick={() => {
              setTargetUser(null)
              setUserQuery('')
              setUserResults([])
              setShowRaiseModal(true)
            }}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: '#059669',
              borderColor: '#059669',
              fontSize: '0.75rem',
              fontWeight: 700,
              height: 30,
              padding: '0 0.75rem',
              whiteSpace: 'nowrap',
              borderRadius: '0.4rem',
            }}
          >
            <PlusCircle size={14} /> Raise Ticket as Admin
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODE 1: DIRECT CHAT VIEW (PRIMARY INBOX) */}
      {/* ───────────────────────────────────────────────────────── */}
      {activeTab === 'direct_chat' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr)',
          gap: '0.625rem',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {/* Left Panel: Direct Conversations */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#f8fafc', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {/* Search Bar */}
            <div style={{ padding: '0.625rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    className="input"
                    value={directSearch}
                    onChange={e => setDirectSearch(e.target.value)}
                    placeholder="Search chats…"
                    style={{ paddingLeft: '1.75rem', height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowNewChat(true)}
                  style={{ height: 32, padding: '0 0.55rem', flexShrink: 0 }}
                  title="New Chat"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Role filter bar */}
              <div style={{ display: 'flex', gap: '0.2rem', overflowX: 'auto' }}>
                <button
                  onClick={() => setDirectRoleFilter('all')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: directRoleFilter === 'all' ? '#0f172a' : '#e2e8f0',
                    background: directRoleFilter === 'all' ? '#0f172a' : '#ffffff',
                    color: directRoleFilter === 'all' ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All ({directConversations.length})
                </button>
                <button
                  onClick={() => setDirectRoleFilter('customer')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: directRoleFilter === 'customer' ? '#4f46e5' : '#e2e8f0',
                    background: directRoleFilter === 'customer' ? '#eef2ff' : '#ffffff',
                    color: directRoleFilter === 'customer' ? '#4f46e5' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  👤 Customers
                </button>
                <button
                  onClick={() => setDirectRoleFilter('worker')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: directRoleFilter === 'worker' ? '#0284c7' : '#e2e8f0',
                    background: directRoleFilter === 'worker' ? '#f0f9ff' : '#ffffff',
                    color: directRoleFilter === 'worker' ? '#0284c7' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  👷 Workers
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {filteredConversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                  No conversations found.
                </div>
              ) : (
                filteredConversations.map(c => {
                  const isSelected = c.user_id === selectedUserId
                  const isOnline = onlineUserIds.has(c.user_id)
                  const isWorker = c.role === 'worker'

                  return (
                    <div
                      key={c.user_id}
                      onClick={() => setSelectedUserId(c.user_id)}
                      style={{
                        padding: '0.55rem 0.65rem',
                        borderRadius: '0.45rem',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: '1px solid',
                        borderColor: isSelected ? '#93c5fd' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isWorker ? '#0284c7' : '#4f46e5',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                        }}>
                          {c.user_name.charAt(0).toUpperCase()}
                        </div>
                        {isOnline && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            border: '1.5px solid #ffffff',
                          }} />
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.user_name}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: '#94a3b8', flexShrink: 0, marginLeft: 4 }}>
                            {new Date(c.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                          <span style={{
                            fontSize: '0.68rem',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {c.last_message.sender === 'admin' ? 'You: ' : ''}
                            {c.last_message.content.startsWith('[TICKET:') ? '🎫 Support Ticket' : c.last_message.content}
                          </span>

                          {c.unread_count > 0 && (
                            <span style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              padding: '0.02rem 0.35rem',
                              borderRadius: 99,
                              marginLeft: 4,
                              flexShrink: 0,
                            }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Panel: Active Chat Pane */}
          {selectedConversation ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              {/* Header Bar */}
              <div style={{
                padding: '0.65rem 1rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: selectedConversation.role === 'worker' ? '#0284c7' : '#4f46e5',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    flexShrink: 0,
                  }}>
                    {selectedConversation.user_name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedConversation.user_name}
                      </h4>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '0.08rem 0.35rem',
                        borderRadius: '0.2rem',
                        background: selectedConversation.role === 'worker' ? '#f0f9ff' : '#eef2ff',
                        color: selectedConversation.role === 'worker' ? '#0369a1' : '#4f46e5',
                        border: `1px solid ${selectedConversation.role === 'worker' ? '#bae6fd' : '#c7d2fe'}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {selectedConversation.role === 'worker' ? '👷 Worker' : '👤 Customer'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                      <a href={`tel:${selectedConversation.user_phone}`} style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Phone size={10} /> +91 {selectedConversation.user_phone}
                      </a>
                      <span>•</span>
                      <span style={{ color: onlineUserIds.has(selectedConversation.user_id) ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                        {onlineUserIds.has(selectedConversation.user_id) ? '● Online' : '○ Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 🌟 RAISE TICKET ACTION BUTTON INSIDE CHAT 🌟 */}
                <button
                  type="button"
                  onClick={handleToggleInlineTicket}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: showInlineTicketForm ? '#f1f5f9' : '#059669',
                    border: '1px solid',
                    borderColor: showInlineTicketForm ? '#cbd5e1' : '#059669',
                    color: showInlineTicketForm ? '#334155' : '#ffffff',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: showInlineTicketForm ? 'none' : '0 2px 5px rgba(5, 150, 105, 0.25)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Ticket size={14} />
                  {showInlineTicketForm ? 'Cancel Ticket' : 'Raise Ticket for User'}
                </button>
              </div>

              {/* Chat Message Stream */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '0.875rem',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                minHeight: 0,
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}>
                {selectedConversation.messages.map((m, idx) => {
                  const isAdmin = m.sender === 'admin'
                  const isTicketPayload = m.content.startsWith('[TICKET:')
                  const isStatusPayload = m.content.startsWith('[STATUS:')

                  return (
                    <div
                      key={m.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isTicketPayload || isStatusPayload ? 'center' : (isAdmin ? 'flex-end' : 'flex-start'),
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{
                        maxWidth: isTicketPayload ? '100%' : (isStatusPayload ? '88%' : '75%'),
                        padding: isTicketPayload || isStatusPayload ? '0' : '0.6rem 0.85rem',
                        borderRadius: isAdmin ? '0.75rem 0.75rem 0.2rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.2rem',
                        background: isTicketPayload || isStatusPayload ? 'transparent' : (isAdmin ? '#4f46e5' : '#ffffff'),
                        color: isAdmin ? '#ffffff' : '#1e293b',
                        fontSize: '0.825rem',
                        boxShadow: isTicketPayload || isStatusPayload ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                        border: isTicketPayload || isStatusPayload || isAdmin ? 'none' : '1px solid #e2e8f0',
                        boxSizing: 'border-box',
                      }}>
                        {renderChatMessageBubbleContent(m.content, isAdmin)}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.12rem' }}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isAdmin && <CheckCheck size={11} color={m.is_read ? '#4f46e5' : '#94a3b8'} />}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ── INLINE TICKET CREATOR FORM INSIDE ACTIVE CHAT ── */}
              {showInlineTicketForm && (
                <div style={{
                  padding: '0.875rem 1rem',
                  background: '#f8fafc',
                  borderTop: '2px solid #6366f1',
                  borderBottom: '1px solid #e2e8f0',
                  boxShadow: '0 -4px 12px rgba(99, 102, 241, 0.08)',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  width: '100%',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.825rem', color: '#4338ca' }}>
                      <Ticket size={15} /> Raise Support Ticket for {selectedConversation.user_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInlineTicketForm(false)}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <form onSubmit={handleAdminCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                          Category *
                        </label>
                        <select
                          className="input"
                          value={adminCategory}
                          onChange={e => setAdminCategory(e.target.value as TicketCategory)}
                          style={{ height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                        >
                          {Object.keys(TICKET_CATEGORIES).map(k => (
                            <option key={k} value={k}>
                              {TICKET_CATEGORIES[k as TicketCategory].emoji} {TICKET_CATEGORIES[k as TicketCategory].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                          Priority
                        </label>
                        <select
                          className="input"
                          value={adminPriority}
                          onChange={e => setAdminPriority(e.target.value as TicketPriority)}
                          style={{ height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                        >
                          <option value="low">🟢 Low</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="high">🟠 High</option>
                          <option value="urgent">🔴 Urgent</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                          Booking (Optional)
                        </label>
                        <select
                          className="input"
                          value={adminJobId}
                          onChange={e => setAdminJobId(e.target.value)}
                          style={{ height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                        >
                          <option value="">-- None / General --</option>
                          {userJobs.map(j => (
                            <option key={j.id} value={j.id}>
                              {j.skills?.name || 'Job'} (#{j.id.slice(0, 6)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                        Issue Subject *
                      </label>
                      <input
                        className="input"
                        value={adminSubject}
                        onChange={e => setAdminSubject(e.target.value)}
                        placeholder="e.g. Technician delayed / Payment inquiry"
                        required
                        style={{ height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                        Description & Details *
                      </label>
                      <textarea
                        className="input"
                        rows={2}
                        value={adminDescription}
                        onChange={e => setAdminDescription(e.target.value)}
                        placeholder="Provide details about the issue to log official ticket…"
                        required
                        style={{ fontSize: '0.75rem', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginTop: '0.15rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowInlineTicketForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-sm"
                        disabled={creatingTicket}
                        style={{ background: '#059669', color: '#ffffff', border: 'none', fontWeight: 700 }}
                      >
                        {creatingTicket ? 'Creating…' : '🎟️ Create & Post Ticket to Chat'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Quick Reply Bar */}
              <div style={{
                padding: '0.35rem 0.75rem',
                background: '#f1f5f9',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.3rem',
                overflowX: 'auto',
                overflowY: 'hidden',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.15rem', marginRight: '0.15rem', flexShrink: 0 }}>
                  <Zap size={11} color="#f59e0b" /> Quick:
                </span>
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendDirectMessage(undefined, qr)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 99,
                      padding: '0.12rem 0.5rem',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {qr.slice(0, 26)}…
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={e => handleSendDirectMessage(e)}
                style={{
                  padding: '0.625rem 0.875rem',
                  background: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.5rem',
                  flexShrink: 0,
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  alignItems: 'center',
                }}
              >
                <input
                  className="input"
                  value={directInputText}
                  onChange={e => setDirectInputText(e.target.value)}
                  placeholder="Type a message to user…"
                  style={{
                    flex: 1,
                    height: 38,
                    minWidth: 0,
                    fontSize: '0.825rem',
                    borderRadius: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    height: 38,
                    padding: '0 1.25rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    flexShrink: 0,
                    fontWeight: 700,
                    borderRadius: '0.5rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Send size={15} /> Send
                </button>
              </form>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', gap: '0.5rem' }}>
              <MessageCircle size={36} style={{ opacity: 0.3 }} />
              <div>Select a conversation from the left to start chatting.</div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODE 2: SUPPORT TICKETS DESK */}
      {/* ───────────────────────────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '300px minmax(0, 1fr)',
          gap: '0.625rem',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {/* Left Column: Tickets List */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#f8fafc', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.625rem', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: '#ffffff' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  className="input"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search Ticket #, Name…"
                  style={{ paddingLeft: '1.75rem', height: 32, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.2rem', overflowX: 'auto' }}>
                <button
                  onClick={() => setRoleFilter('all')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: roleFilter === 'all' ? '#0f172a' : '#e2e8f0',
                    background: roleFilter === 'all' ? '#0f172a' : '#ffffff',
                    color: roleFilter === 'all' ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All ({parsedTickets.length})
                </button>
                <button
                  onClick={() => setRoleFilter('customer')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: roleFilter === 'customer' ? '#4f46e5' : '#e2e8f0',
                    background: roleFilter === 'customer' ? '#eef2ff' : '#ffffff',
                    color: roleFilter === 'customer' ? '#4f46e5' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  👤 Customers
                </button>
                <button
                  onClick={() => setRoleFilter('worker')}
                  style={{
                    padding: '0.12rem 0.45rem',
                    borderRadius: 99,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: roleFilter === 'worker' ? '#0284c7' : '#e2e8f0',
                    background: roleFilter === 'worker' ? '#f0f9ff' : '#ffffff',
                    color: roleFilter === 'worker' ? '#0284c7' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  👷 Workers
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {filteredTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                  No tickets found matching filters.
                </div>
              ) : (
                filteredTickets.map(t => {
                  const isSelected = t.id === selectedTicketId
                  const st = TICKET_STATUSES[t.status] || TICKET_STATUSES.open
                  const isWorker = t.userRole === 'worker'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      style={{
                        padding: '0.55rem 0.65rem',
                        borderRadius: '0.45rem',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: '1px solid',
                        borderColor: isSelected ? '#93c5fd' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4338ca' }}>#{t.id}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.3rem', borderRadius: '0.2rem', background: isWorker ? '#f0f9ff' : '#eef2ff', color: isWorker ? '#0284c7' : '#4f46e5' }}>
                            {isWorker ? 'Worker' : 'Customer'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.35rem', borderRadius: 99, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b' }}>{t.subject}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>👤 {t.userName}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Ticket Detail */}
          {selectedTicket ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '0.65rem 1rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Ticket #{selectedTicket.id}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', background: '#f8fafc', padding: '0.08rem 0.35rem', borderRadius: '0.2rem', border: '1px solid #e2e8f0' }}>
                      {selectedTicket.categoryLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e293b', marginTop: '0.1rem' }}>{selectedTicket.subject}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    onClick={() => handleShareTicketInChat(selectedTicket)}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.3rem 0.55rem', borderRadius: '0.35rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <Share2 size={12} /> Share
                  </button>
                  <select
                    className="input"
                    value={selectedTicket.status}
                    onChange={e => handleUpdateTicketStatus(e.target.value as TicketStatus)}
                    style={{ height: 32, fontSize: '0.72rem', fontWeight: 700 }}
                  >
                    <option value="open">🟡 Open</option>
                    <option value="in_progress">🔵 In Progress</option>
                    <option value="resolved">🟢 Resolved</option>
                    <option value="closed">⚪ Closed</option>
                  </select>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0, boxSizing: 'border-box' }}>
                {selectedTicket.description && (
                  <div style={{ background: '#ffffff', borderRadius: '0.45rem', border: '1px solid #e2e8f0', padding: '0.65rem', fontSize: '0.78rem', color: '#334155' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.2rem', fontSize: '0.68rem', color: '#64748b' }}>Initial Issue:</div>
                    {selectedTicket.description}
                  </div>
                )}

                {selectedTicket.messages.map((m, idx) => (
                  <div key={m.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender === 'admin' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: m.sender === 'admin' ? '0.65rem 0.65rem 0.15rem 0.65rem' : '0.65rem 0.65rem 0.65rem 0.15rem',
                      background: m.sender === 'admin' ? '#4f46e5' : '#ffffff',
                      color: m.sender === 'admin' ? '#ffffff' : '#1e293b',
                      fontSize: '0.78rem',
                      border: m.sender === 'admin' ? 'none' : '1px solid #e2e8f0',
                      boxSizing: 'border-box',
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendTicketReply} style={{ padding: '0.55rem 0.875rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.45rem', boxSizing: 'border-box', width: '100%' }}>
                <input
                  className="input"
                  value={ticketReplyText}
                  onChange={e => setTicketReplyText(e.target.value)}
                  placeholder="Type a response to this ticket…"
                  style={{ flex: 1, height: 36, fontSize: '0.78rem', minWidth: 0 }}
                />
                <button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 0.85rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Send size={14} /> Send Reply
                </button>
              </form>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Select a ticket to view details.
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* ADMIN RAISE TICKET MODAL (GLOBAL ACTION) */}
      {/* ───────────────────────────────────────────────────────── */}
      {showRaiseModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }} onClick={() => setShowRaiseModal(false)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: 500,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <PlusCircle size={16} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Raise Support Ticket (Admin)</h3>
              </div>
              <button onClick={() => setShowRaiseModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleAdminCreateTicket} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto' }}>
              {/* User Selector */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Target User *</label>
                {targetUser ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.45rem 0.65rem', borderRadius: '0.35rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#15803d' }}>{targetUser.profiles?.name || 'User'} ({targetUser.role})</div>
                      <div style={{ fontSize: '0.68rem', color: '#166534' }}>+91 {targetUser.phone}</div>
                    </div>
                    <button type="button" onClick={() => setTargetUser(null)} style={{ border: 'none', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Change</button>
                  </div>
                ) : (
                  <div>
                    <input
                      className="input"
                      value={userQuery}
                      onChange={e => handleSearchTargetUsers(e.target.value)}
                      placeholder="Type name or phone number…"
                      style={{ height: 34, fontSize: '0.78rem' }}
                    />
                    {userResults.length > 0 && (
                      <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.35rem', marginTop: 4, background: '#fff' }}>
                        {userResults.map(u => (
                          <div
                            key={u.id}
                            onClick={() => { setTargetUser(u); setUserResults([]) }}
                            style={{ padding: '0.4rem 0.65rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}
                          >
                            <span><strong>{u.profiles?.name || 'User'}</strong> (+91 {u.phone})</span>
                            <span style={{ color: u.role === 'worker' ? '#0284c7' : '#4f46e5', fontWeight: 700 }}>{u.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Category & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Category *</label>
                  <select className="input" value={adminCategory} onChange={e => setAdminCategory(e.target.value as TicketCategory)} style={{ height: 34, fontSize: '0.75rem' }}>
                    {Object.keys(TICKET_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{TICKET_CATEGORIES[cat as TicketCategory].emoji} {TICKET_CATEGORIES[cat as TicketCategory].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Priority</label>
                  <select className="input" value={adminPriority} onChange={e => setAdminPriority(e.target.value as TicketPriority)} style={{ height: 34, fontSize: '0.75rem' }}>
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Subject *</label>
                <input className="input" value={adminSubject} onChange={e => setAdminSubject(e.target.value)} placeholder="e.g. Dihaadi Payout Issue" required style={{ height: 34, fontSize: '0.78rem' }} />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Description *</label>
                <textarea className="input" rows={3} value={adminDescription} onChange={e => setAdminDescription(e.target.value)} placeholder="Provide issue details…" required style={{ fontSize: '0.78rem' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', marginTop: '0.4rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRaiseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creatingTicket || !targetUser} style={{ background: '#059669', borderColor: '#059669' }}>
                  {creatingTicket ? 'Creating…' : 'Create & Post Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* NEW CHAT MODAL */}
      {/* ───────────────────────────────────────────────────────── */}
      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Start Direct Chat</h3>
              <button onClick={() => setShowNewChat(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input className="input" value={newChatQuery} onChange={e => handleSearchNewChatUsers(e.target.value)} placeholder="Search user by phone or email…" autoFocus style={{ height: 34, fontSize: '0.78rem' }} />
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {newChatResults.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setSelectedUserId(u.id); setShowNewChat(false) }}
                    style={{ padding: '0.55rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{u.profiles?.name || 'User'}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>+91 {u.phone} • {u.role}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 700 }}>Chat →</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
