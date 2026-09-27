import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useNavigate } from 'react-router-dom'
import { SupportTicketModal } from '@/components/SupportTicketModal'
import {
  HardHat, Inbox, Briefcase, History, CheckCircle, XCircle,
  MapPin, User, Phone, Clock, Navigation, Star, AlertTriangle,
  RefreshCw, ChevronRight, LifeBuoy, Ticket
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface Skill { name: string; icon: string }

interface Job {
  id: string
  status: string
  address: string
  area: string
  price: number | null
  description: string | null
  created_at: string
  skill_id: string
  customer_id: string
  worker_id: string | null
  skills: Skill | null
  customer: { phone: string; profiles: { name: string | null } | null } | null
  rating: { score: number; comment: string | null } | null
}

// ─────────────────────────────────────────────────────────────────
// Status pipeline — shared with MyBookingsPage design
// ─────────────────────────────────────────────────────────────────
interface StatusStep {
  status: string
  label: string
  emoji: string
  color: string
  bgColor: string
  borderColor: string
  nextAction: string | null
}

const STATUS_PIPELINE: StatusStep[] = [
  { status: 'accepted',  label: 'Accepted',      emoji: '✅', color: '#065f46', bgColor: '#d1fae5', borderColor: '#6ee7b7', nextAction: 'on_way' },
  { status: 'on_way',    label: 'On My Way',     emoji: '🚗', color: '#1e3a8a', bgColor: '#e0f2fe', borderColor: '#38bdf8', nextAction: 'arrived' },
  { status: 'arrived',   label: 'Arrived',       emoji: '📍', color: '#1e3a8a', bgColor: '#e0f2fe', borderColor: '#38bdf8', nextAction: 'working' },
  { status: 'working',   label: 'Working',       emoji: '🔧', color: '#3730a3', bgColor: '#ede9fe', borderColor: '#a78bfa', nextAction: 'completed' },
  { status: 'completed', label: 'Completed',     emoji: '✓',  color: '#065f46', bgColor: '#d1fae5', borderColor: '#6ee7b7', nextAction: null },
]

const NEXT_ACTION_LABELS: Record<string, { label: string; emoji: string }> = {
  on_way:    { label: 'Start Heading Out',  emoji: '🚗' },
  arrived:   { label: 'Mark as Arrived',    emoji: '📍' },
  working:   { label: 'Start Working',      emoji: '🔧' },
  completed: { label: 'Complete Job',       emoji: '✅' },
}

function getStatusStep(status: string): StatusStep | undefined {
  return STATUS_PIPELINE.find(s => s.status === status)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────
// Progress Bar (reused pattern)
// ─────────────────────────────────────────────────────────────────
const ORDERED = ['accepted', 'on_way', 'arrived', 'working', 'completed']

function ProgressBar({ status }: { status: string }) {
  const idx = ORDERED.indexOf(status)
  if (idx < 0) return null

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: '#e5e7eb', transform: 'translateY(-50%)', zIndex: 0 }} />
        <div style={{
          position: 'absolute', top: '50%', left: 0, height: 3,
          width: `${Math.max(0, (idx / (ORDERED.length - 1)) * 100)}%`,
          background: 'linear-gradient(90deg, #4f46e5, #10b981)',
          transform: 'translateY(-50%)', zIndex: 1, transition: 'width 0.3s ease',
          borderRadius: 99,
        }} />
        {ORDERED.map((s, i) => {
          const done = i <= idx
          const active = i === idx
          return (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
              <div style={{
                width: active ? 22 : 14, height: active ? 22 : 14, borderRadius: '50%',
                background: done ? (active ? 'linear-gradient(135deg, #4f46e5, #818cf8)' : '#10b981') : '#e5e7eb',
                border: active ? '3px solid #c7d2fe' : 'none',
                transition: 'all 0.3s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5rem', color: '#fff', fontWeight: 800,
              }}>
                {done && !active && '✓'}
              </div>
              <span style={{
                fontSize: '0.55rem', fontWeight: active ? 700 : 500,
                color: done ? '#334155' : '#94a3b8',
                marginTop: 4, whiteSpace: 'nowrap',
              }}>
                {STATUS_PIPELINE.find(p => p.status === s)?.label || s}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────
type Tab = 'incoming' | 'active' | 'history'

export function WorkerDashboardPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { customer, isLoggedIn, updateProfile } = useCustomerAuth()

  const [tab, setTab] = useState<Tab>('incoming')
  const [incomingJobs, setIncomingJobs] = useState<Job[]>([])
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [historyJobs, setHistoryJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(customer?.is_available !== false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)

  // Stats
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)

  // ── Guard: Only workers can see this page ──────────────────
  useEffect(() => {
    if (!isLoggedIn || customer?.role !== 'worker') {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, customer?.role, navigate])

  // ── Fetch all job data ─────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    if (!customer?.id) return
    setLoading(true)

    try {
      // 1. Incoming: Jobs in worker's area that are 'requested'
      //    + jobs directly assigned to this worker that are still 'requested'
      const workerArea = customer.area || ''
      const { data: incoming } = await supabase
        .from('jobs')
        .select(`
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name))
        `)
        .eq('status', 'requested')
        .order('created_at', { ascending: false })
        .limit(50)

      // Filter: jobs in worker's area OR directly assigned
      const filtered = (incoming || []).filter((j: any) => {
        const jobArea = (j.area || '').toLowerCase()
        const wArea = workerArea.toLowerCase()
        return j.worker_id === customer.id ||
               (wArea && (jobArea.includes(wArea) || wArea.includes(jobArea)))
      })
      setIncomingJobs(filtered as unknown as Job[])

      // 2. Active: Jobs assigned to this worker with active status
      const { data: active } = await supabase
        .from('jobs')
        .select(`
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name))
        `)
        .eq('worker_id', customer.id)
        .in('status', ['accepted', 'on_way', 'arrived', 'working'])
        .order('created_at', { ascending: false })

      setActiveJobs((active || []) as unknown as Job[])

      // 3. History: Completed + cancelled jobs for this worker
      const { data: history } = await supabase
        .from('jobs')
        .select(`
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name)),
          ratings!ratings_job_id_fkey (score, comment)
        `)
        .eq('worker_id', customer.id)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(50)

      // Flatten ratings (it comes as array from join)
      const historyNorm = (history || []).map((j: any) => ({
        ...j,
        rating: Array.isArray(j.ratings) && j.ratings.length > 0
          ? { score: j.ratings[0].score, comment: j.ratings[0].comment }
          : null,
      }))
      setHistoryJobs(historyNorm as unknown as Job[])

      // Stats
      const completed = historyNorm.filter((j: any) => j.status === 'completed')
      setTotalCompleted(completed.length)

      if (completed.length > 0) {
        const ratings = completed.filter((j: any) => j.rating?.score).map((j: any) => j.rating.score)
        if (ratings.length > 0) {
          setAvgRating(+(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1))
        }
      }
    } catch (err: any) {
      console.error('Worker dashboard fetch error:', err)
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [customer?.id, customer?.area, toast])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // ── Realtime subscription for new jobs ─────────────────────
  useEffect(() => {
    if (!customer?.id) return

    const channel = supabase
      .channel('worker-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => fetchJobs()
      )
      .subscribe()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchJobs()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [customer?.id, fetchJobs])

  // ── Accept Job ─────────────────────────────────────────────
  async function handleAccept(jobId: string) {
    if (!customer?.id) return
    setActioningId(jobId)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ worker_id: customer.id, status: 'accepted' })
        .eq('id', jobId)

      if (error) throw error
      
      const job = incomingJobs.find(j => j.id === jobId)
      if (job?.customer_id) {
         const msg = `${customer.name || 'A Mistri'} has accepted your request and will be on their way soon.`
         await supabase.from('notifications').insert({
           user_id: job.customer_id,
           title: 'Worker Assigned',
           message: msg,
           type: 'job_update',
           reference_id: jobId
         })
         
         // Customer relies on in-app bell notification
         // Admin Email Notification
         const skillName = job.skills?.name || 'a service'
         
         const host = window.location.hostname
         const adminPort = '3001'
         const adminUrl = `${window.location.protocol}//${host}:${adminPort}/jobs`

         fetch('http://localhost:3002/api/notify/admin', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             message: `MistriJi: Worker ${customer?.name || 'Worker'} accepted ${skillName} in ${job.area}.`,
             link: adminUrl
           })
         }).catch(() => {})
         
         // Notify Admin via in-app notifications
         try {
           await supabase.rpc('notify_admins', {
             p_title: 'Job Accepted by Worker',
             p_message: `Worker ${customer?.name || 'Worker'} accepted ${skillName} in ${job.area}.`,
             p_type: 'job_update',
             p_reference_id: jobId
           })
         } catch (notifErr) {
           console.error('Failed to create admin in-app notifications', notifErr)
         }
      }

      toast.success('🎉 Job accepted! The customer has been notified.')
      await fetchJobs()
      setTab('active')
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept job')
    } finally {
      setActioningId(null)
    }
  }

  // ── Reject/Skip Job ───────────────────────────────────────
  async function handleReject(jobId: string) {
    setActioningId(jobId)
    try {
      // Just remove from local list for now (broadcast model — worker skips)
      setIncomingJobs(prev => prev.filter(j => j.id !== jobId))
      toast.info('Job skipped')
    } finally {
      setActioningId(null)
    }
  }

  // ── Update Status ─────────────────────────────────────────
  async function handleStatusUpdate(jobId: string, newStatus: string) {
    setActioningId(jobId)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)

      if (error) throw error

      const job = activeJobs.find(j => j.id === jobId)
      const step = STATUS_PIPELINE.find(s => s.status === newStatus)
      if (job?.customer_id && step) {
         const msg = `Your service request status is now: ${step.label}`
         await supabase.from('notifications').insert({
           user_id: job.customer_id,
           title: 'Job Update',
           message: msg,
           type: 'job_update',
           reference_id: jobId
         })
         
         // Customer relies on in-app bell notification
         // Admin Email Notification
         if (newStatus === 'completed' || newStatus === 'cancelled') {
           const host = window.location.hostname
           const adminPort = '3001'
           const adminUrl = `${window.location.protocol}//${host}:${adminPort}/jobs`

           fetch('http://localhost:3002/api/notify/admin', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               message: `MistriJi: Job ${jobId.substring(0,6)} was marked as ${newStatus.toUpperCase()} by ${customer?.name || 'Worker'}.`,
               link: adminUrl
             })
           }).catch(() => {})
           
           // Notify Admin via in-app notifications
           try {
             await supabase.rpc('notify_admins', {
               p_title: 'Job Status Updated',
               p_message: `Job ${jobId.substring(0,6)} was marked as ${newStatus.toUpperCase()} by ${customer?.name || 'Worker'}.`,
               p_type: 'job_update',
               p_reference_id: jobId
             })
           } catch (notifErr) {
             console.error('Failed to create admin in-app notifications', notifErr)
           }
         }
      }

      toast.success(`${step?.emoji || '✓'} Status updated to: ${step?.label || newStatus}`)
      await fetchJobs()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setActioningId(null)
    }
  }

  // ── Toggle Availability ───────────────────────────────────
  async function handleToggleAvailability() {
    const newVal = !isAvailable
    setIsAvailable(newVal)

    try {
      await updateProfile({
        name: customer?.name || 'Worker',
        is_available: newVal,
      })
      toast.success(newVal ? '🟢 You are now ON DUTY — visible to customers' : '🔴 You are now OFF DUTY — hidden from new requests')
    } catch {
      setIsAvailable(!newVal) // revert
      toast.error('Failed to update availability')
    }
  }

  if (!isLoggedIn || customer?.role !== 'worker') return null

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="worker-dashboard">
      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="worker-hero">
        <div className="worker-hero-inner">
          <div className="worker-hero-top">
            <div className="worker-hero-info">
              <div className="worker-avatar">
                {customer?.name?.[0] || 'W'}
              </div>
              <div>
                <div className="worker-hero-name">{customer?.name || 'Worker'}</div>
                <div className="worker-hero-role">
                  <HardHat size={12} /> Verified Mistri Partner
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              {/* Help & Support Button */}
              <button
                type="button"
                onClick={() => setIsSupportOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#ffffff',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.15s ease',
                }}
                title="Open Helpdesk & Raise Support Tickets"
              >
                <LifeBuoy size={14} /> Helpdesk / Tickets
              </button>

              {/* Availability Toggle */}
              <div className="availability-toggle" onClick={handleToggleAvailability}>
                <span className={`availability-toggle-label ${isAvailable ? 'on' : 'off'}`}>
                  {isAvailable ? 'On Duty' : 'Off Duty'}
                </span>
                <div className={`toggle-track ${isAvailable ? 'on' : 'off'}`}>
                  <div className={`toggle-thumb ${isAvailable ? 'on' : 'off'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="worker-stats-grid">
            <div className="worker-stat-card">
              <div className="worker-stat-value">{incomingJobs.length}</div>
              <div className="worker-stat-label">New Requests</div>
            </div>
            <div className="worker-stat-card">
              <div className="worker-stat-value">{totalCompleted}</div>
              <div className="worker-stat-label">Jobs Done</div>
            </div>
            <div className="worker-stat-card">
              <div className="worker-stat-value">
                {avgRating ? `${avgRating}★` : '—'}
              </div>
              <div className="worker-stat-label">Avg Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────── */}
      <div className="worker-tabs">
        <button className={`worker-tab ${tab === 'incoming' ? 'active' : ''}`} onClick={() => setTab('incoming')}>
          <Inbox size={14} />
          <span>Incoming</span>
          {incomingJobs.length > 0 && <span className="worker-tab-badge">{incomingJobs.length}</span>}
        </button>
        <button className={`worker-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          <Briefcase size={14} />
          <span>Active</span>
          {activeJobs.length > 0 && <span className="worker-tab-badge">{activeJobs.length}</span>}
        </button>
        <button className={`worker-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <History size={14} />
          <span>History</span>
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="worker-content">

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: 28, height: 28, color: 'var(--brand-500)' }} />
            <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Loading your dashboard…</p>
          </div>
        ) : (
          <>
            {/* ─── INCOMING JOBS TAB ──────────────────────────── */}
            {tab === 'incoming' && (
              <>
                {!isAvailable && (
                  <div style={{
                    background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.75rem',
                    padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex',
                    alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#92400e',
                  }}>
                    <AlertTriangle size={16} />
                    <span><strong>You're off duty.</strong> Toggle availability to receive new job requests.</span>
                  </div>
                )}

                {incomingJobs.length === 0 ? (
                  <div className="worker-empty">
                    <div className="worker-empty-icon">📭</div>
                    <div className="worker-empty-title">No incoming requests</div>
                    <div className="worker-empty-desc">
                      New job requests from customers in your area will appear here. Stay on duty to receive them!
                    </div>
                  </div>
                ) : (
                  incomingJobs.map(job => (
                    <div key={job.id} className="worker-job-card">
                      <div className="worker-job-card-header">
                        <div className="worker-job-service">
                          <div className="worker-job-service-icon">{job.skills?.icon || '🔧'}</div>
                          <div>
                            <div className="worker-job-service-name">{job.skills?.name || 'Service'}</div>
                            <div className="worker-job-service-time">
                              <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                              {timeAgo(job.created_at)}
                            </div>
                          </div>
                        </div>
                        {job.price && <div className="worker-job-price">₹{job.price}</div>}
                      </div>

                      <div className="worker-job-details">
                        <div className="worker-job-detail-row">
                          <MapPin size={13} /> {job.area} — {job.address}
                        </div>
                        <div className="worker-job-detail-row">
                          <User size={13} /> {(job.customer as any)?.profiles?.name || 'Customer'}
                        </div>
                      </div>

                      {job.description && (
                        <div className="worker-job-description">📝 {job.description}</div>
                      )}

                      <div className="worker-job-actions">
                        <button
                          className="worker-accept-btn"
                          onClick={() => handleAccept(job.id)}
                          disabled={actioningId === job.id}
                        >
                          {actioningId === job.id ? 'Accepting…' : <><CheckCircle size={15} /> Accept Job</>}
                        </button>
                        <button
                          className="worker-reject-btn"
                          onClick={() => handleReject(job.id)}
                          disabled={actioningId === job.id}
                        >
                          <XCircle size={15} /> Skip
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* ─── ACTIVE JOBS TAB ────────────────────────────── */}
            {tab === 'active' && (
              <>
                {activeJobs.length === 0 ? (
                  <div className="worker-empty">
                    <div className="worker-empty-icon">🛠️</div>
                    <div className="worker-empty-title">No active jobs</div>
                    <div className="worker-empty-desc">
                      Accept a job from the Incoming tab to start working. Your active jobs will appear here.
                    </div>
                  </div>
                ) : (
                  activeJobs.map(job => {
                    const step = getStatusStep(job.status)
                    const nextStatus = step?.nextAction
                    const nextLabel = nextStatus ? NEXT_ACTION_LABELS[nextStatus] : null
                    const customerPhone = (job.customer as any)?.phone

                    return (
                      <div key={job.id} className="worker-job-card">
                        <div className="worker-job-card-header">
                          <div className="worker-job-service">
                            <div className="worker-job-service-icon">{job.skills?.icon || '🔧'}</div>
                            <div>
                              <div className="worker-job-service-name">{job.skills?.name || 'Service'}</div>
                              <div className="worker-job-service-time">{formatDate(job.created_at)}</div>
                            </div>
                          </div>
                          {step && (
                            <div className="worker-job-status-badge" style={{
                              background: step.bgColor,
                              color: step.color,
                              border: `1px solid ${step.borderColor}`,
                            }}>
                              {step.emoji} {step.label}
                            </div>
                          )}
                        </div>

                        <ProgressBar status={job.status} />

                        <div className="worker-job-details">
                          <div className="worker-job-detail-row">
                            <MapPin size={13} /> {job.area} — {job.address}
                          </div>
                          <div className="worker-job-detail-row">
                            <User size={13} /> {(job.customer as any)?.profiles?.name || 'Customer'}
                            {customerPhone && (
                              <span style={{ color: 'var(--gray-400)', fontSize: '0.72rem' }}>
                                (+91 {customerPhone})
                              </span>
                            )}
                          </div>
                          {job.price && (
                            <div className="worker-job-detail-row">
                              <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>₹{job.price}</span>
                            </div>
                          )}
                        </div>

                        {job.description && (
                          <div className="worker-job-description">📝 {job.description}</div>
                        )}

                        <div className="worker-job-actions">
                          {nextLabel && nextStatus && (
                            <button
                              className={`worker-status-btn ${nextStatus === 'completed' ? 'complete' : ''}`}
                              onClick={() => handleStatusUpdate(job.id, nextStatus)}
                              disabled={actioningId === job.id}
                            >
                              {actioningId === job.id ? 'Updating…' : <>{nextLabel.emoji} {nextLabel.label}</>}
                            </button>
                          )}
                          {customerPhone && (
                            <a href={`tel:+91${customerPhone}`} className="worker-call-btn">
                              <Phone size={14} /> Call
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}

            {/* ─── HISTORY TAB ────────────────────────────────── */}
            {tab === 'history' && (
              <>
                {historyJobs.length === 0 ? (
                  <div className="worker-empty">
                    <div className="worker-empty-icon">📋</div>
                    <div className="worker-empty-title">No job history yet</div>
                    <div className="worker-empty-desc">
                      Your completed and cancelled jobs will appear here for reference.
                    </div>
                  </div>
                ) : (
                  historyJobs.map(job => {
                    const isCompleted = job.status === 'completed'
                    return (
                      <div key={job.id} className="worker-job-card" style={{ opacity: isCompleted ? 1 : 0.7 }}>
                        <div className="worker-job-card-header">
                          <div className="worker-job-service">
                            <div className="worker-job-service-icon">{job.skills?.icon || '🔧'}</div>
                            <div>
                              <div className="worker-job-service-name">{job.skills?.name || 'Service'}</div>
                              <div className="worker-job-service-time">{formatDate(job.created_at)}</div>
                            </div>
                          </div>
                          <div className="worker-job-status-badge" style={{
                            background: isCompleted ? '#d1fae5' : '#fee2e2',
                            color: isCompleted ? '#065f46' : '#991b1b',
                            border: `1px solid ${isCompleted ? '#6ee7b7' : '#f87171'}`,
                          }}>
                            {isCompleted ? '✅ Completed' : '❌ Cancelled'}
                          </div>
                        </div>

                        <div className="worker-job-details">
                          <div className="worker-job-detail-row">
                            <MapPin size={13} /> {job.area} — {job.address}
                          </div>
                          <div className="worker-job-detail-row">
                            <User size={13} /> {(job.customer as any)?.profiles?.name || 'Customer'}
                          </div>
                          {job.price && (
                            <div className="worker-job-detail-row">
                              <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>₹{job.price}</span>
                            </div>
                          )}
                        </div>

                        {/* Rating */}
                        {job.rating && (
                          <div style={{
                            background: '#fefce8', border: '1px solid #fde047', borderRadius: '0.5rem',
                            padding: '0.5rem 0.625rem', fontSize: '0.78rem',
                          }}>
                            <div className="worker-rating" style={{ marginBottom: '0.2rem' }}>
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star key={n} size={14} fill={n <= job.rating!.score ? '#f59e0b' : 'none'} color={n <= job.rating!.score ? '#f59e0b' : '#d1d5db'} />
                              ))}
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', marginLeft: 4 }}>{job.rating.score}/5</span>
                            </div>
                            {job.rating.comment && (
                              <div style={{ color: '#78716c', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                "{job.rating.comment}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </>
            )}
          </>
        )}

        {/* Refresh button */}
        {!loading && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <button
              onClick={fetchJobs}
              style={{
                border: 'none', background: 'transparent', color: 'var(--gray-400)',
                fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '0.3rem', fontWeight: 600,
              }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        )}
      </div>

      {/* Worker Support & Ticket Modal */}
      <SupportTicketModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        forcedRole="worker"
      />
    </div>
  )
}
