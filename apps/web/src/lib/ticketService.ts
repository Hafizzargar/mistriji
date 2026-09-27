export type TicketCategory =
  | 'payment_payout'
  | 'job_dispute'
  | 'cancellation'
  | 'service_quality'
  | 'worker_behavior'
  | 'verification_docs'
  | 'app_technical'
  | 'general_inquiry'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type UserRole = 'customer' | 'worker' | 'admin'

export interface SupportTicket {
  id: string // Ticket ID like TKT-8412
  userId: string
  userRole: 'customer' | 'worker'
  userName: string
  userPhone: string
  userEmail?: string
  subject: string
  category: TicketCategory
  categoryLabel: string
  priority: TicketPriority
  status: TicketStatus
  jobId?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  adminNotes?: string
  messages: TicketMessageItem[]
  unreadByAdminCount?: number
  unreadByUserCount?: number
}

export interface TicketMessageItem {
  id: string
  ticketId: string
  sender: 'user' | 'admin'
  content: string
  createdAt: string
  isRead: boolean
}

export const TICKET_CATEGORIES: Record<TicketCategory, { label: string; emoji: string; roles: ('customer' | 'worker')[] }> = {
  payment_payout: { label: 'Payment & Payouts', emoji: '💰', roles: ['customer', 'worker'] },
  job_dispute: { label: 'Job / Booking Dispute', emoji: '⚠️', roles: ['customer', 'worker'] },
  cancellation: { label: 'Booking Cancellation', emoji: '🚫', roles: ['customer', 'worker'] },
  service_quality: { label: 'Work Quality Complaint', emoji: '🔧', roles: ['customer'] },
  worker_behavior: { label: 'Worker Misconduct / Delay', emoji: '⏱️', roles: ['customer'] },
  verification_docs: { label: 'ID Verification & Documents', emoji: '📄', roles: ['worker'] },
  app_technical: { label: 'App or Technical Bug', emoji: '📱', roles: ['customer', 'worker'] },
  general_inquiry: { label: 'General Inquiry / Other', emoji: '❓', roles: ['customer', 'worker'] },
}

export const TICKET_PRIORITIES: Record<TicketPriority, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Low', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  high: { label: 'High', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

export const TICKET_STATUSES: Record<TicketStatus, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  open: { label: 'Open', emoji: '🟡', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  in_progress: { label: 'In Progress', emoji: '🔵', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  resolved: { label: 'Resolved', emoji: '🟢', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  closed: { label: 'Closed', emoji: '⚪', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
}

// Prefix protocol for storing structured tickets inside support_messages
export const TICKET_PREFIX = '[TICKET:'
export const TICKET_REPLY_PREFIX = '[REPLY:'
export const TICKET_STATUS_PREFIX = '[STATUS:'

export function generateTicketNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `TKT-${num}`
}

export function formatTicketPayload(ticket: {
  ticketId: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  subject: string
  userRole: 'customer' | 'worker'
  userName: string
  userPhone: string
  jobId?: string
  description: string
}): string {
  const meta = {
    ticketId: ticket.ticketId,
    cat: ticket.category,
    pri: ticket.priority,
    st: ticket.status,
    sub: ticket.subject,
    role: ticket.userRole,
    name: ticket.userName,
    phone: ticket.userPhone,
    jobId: ticket.jobId,
  }
  return `${TICKET_PREFIX}${ticket.ticketId}] ${JSON.stringify(meta)}\n\n${ticket.description}`
}

export function formatTicketReply(ticketId: string, replyText: string): string {
  return `${TICKET_REPLY_PREFIX}${ticketId}] ${replyText}`
}

export function formatTicketStatusUpdate(ticketId: string, status: TicketStatus, note?: string): string {
  const meta = { status, note }
  return `${TICKET_STATUS_PREFIX}${ticketId}] ${JSON.stringify(meta)}`
}

export function parseTicketsFromMessages(messages: any[]): SupportTicket[] {
  const ticketMap = new Map<string, SupportTicket>()

  for (const m of messages) {
    const content = m.content || ''

    // 1. Initial Ticket Creation message
    if (content.startsWith(TICKET_PREFIX)) {
      try {
        const closeIdx = content.indexOf(']')
        if (closeIdx === -1) continue
        const ticketId = content.substring(TICKET_PREFIX.length, closeIdx).trim()
        const rest = content.substring(closeIdx + 1).trim()
        const firstLineEnd = rest.indexOf('\n\n')
        const metaStr = firstLineEnd !== -1 ? rest.substring(0, firstLineEnd) : rest
        const desc = firstLineEnd !== -1 ? rest.substring(firstLineEnd + 2) : ''
        const meta = JSON.parse(metaStr)

        const category = (meta.cat || 'general_inquiry') as TicketCategory
        const priority = (meta.pri || 'medium') as TicketPriority
        const status = (meta.st || 'open') as TicketStatus
        const userRole = (meta.role || (m.users?.role === 'worker' ? 'worker' : 'customer')) as 'customer' | 'worker'

        const ticket: SupportTicket = {
          id: ticketId,
          userId: m.user_id,
          userRole,
          userName: meta.name || m.users?.profiles?.name || 'User',
          userPhone: meta.phone || m.users?.phone || '',
          userEmail: m.users?.email || undefined,
          subject: meta.sub || 'Support Request',
          category,
          categoryLabel: TICKET_CATEGORIES[category]?.label || 'General Inquiry',
          priority,
          status,
          jobId: meta.jobId,
          createdAt: m.created_at,
          updatedAt: m.created_at,
          messages: [
            {
              id: m.id,
              ticketId,
              sender: m.sender,
              content: desc || meta.sub || '',
              createdAt: m.created_at,
              isRead: Boolean(m.is_read),
            },
          ],
        }

        ticketMap.set(ticketId, ticket)
      } catch (e) {
        console.error('Error parsing ticket:', e)
      }
      continue
    }

    // 2. Ticket Reply message
    if (content.startsWith(TICKET_REPLY_PREFIX)) {
      const closeIdx = content.indexOf(']')
      if (closeIdx !== -1) {
        const ticketId = content.substring(TICKET_REPLY_PREFIX.length, closeIdx).trim()
        const replyText = content.substring(closeIdx + 1).trim()

        const ticket = ticketMap.get(ticketId)
        if (ticket) {
          ticket.messages.push({
            id: m.id,
            ticketId,
            sender: m.sender,
            content: replyText,
            createdAt: m.created_at,
            isRead: Boolean(m.is_read),
          })
          if (new Date(m.created_at) > new Date(ticket.updatedAt)) {
            ticket.updatedAt = m.created_at
          }
        }
      }
      continue
    }

    // 3. Ticket Status Update message
    if (content.startsWith(TICKET_STATUS_PREFIX)) {
      const closeIdx = content.indexOf(']')
      if (closeIdx !== -1) {
        const ticketId = content.substring(TICKET_STATUS_PREFIX.length, closeIdx).trim()
        const metaStr = content.substring(closeIdx + 1).trim()
        try {
          const meta = JSON.parse(metaStr)
          const ticket = ticketMap.get(ticketId)
          if (ticket) {
            if (meta.status) ticket.status = meta.status
            if (meta.status === 'resolved' || meta.status === 'closed') {
              ticket.resolvedAt = m.created_at
            }
            if (meta.note) ticket.adminNotes = meta.note
            if (new Date(m.created_at) > new Date(ticket.updatedAt)) {
              ticket.updatedAt = m.created_at
            }
          }
        } catch (e) {
          console.error('Error parsing status update:', e)
        }
      }
      continue
    }
  }

  // Calculate unread counts
  return Array.from(ticketMap.values()).map(ticket => {
    ticket.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const unreadByAdmin = ticket.messages.filter(m => m.sender === 'user' && !m.isRead).length
    const unreadByUser = ticket.messages.filter(m => m.sender === 'admin' && !m.isRead).length
    return {
      ...ticket,
      unreadByAdminCount: unreadByAdmin,
      unreadByUserCount: unreadByUser,
    }
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}
