import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useNavigate } from 'react-router-dom'
import { notifyAdmin, getAdminUrl } from '@/api'
import { SupportTicketModal } from '@/components/SupportTicketModal'
import {
  HardHat, Inbox, Briefcase, History, CheckCircle, XCircle,
  MapPin, User, Phone, Clock, Navigation, Star, AlertTriangle,
  RefreshCw, ChevronRight, LifeBuoy, Ticket, Zap
} from 'lucide-react'
import { fetchPaymentSettings, PaymentSettings } from '@/lib/settings'

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
  contact_name: string | null
  contact_phone: string | null
  skill_id: string
  customer_id: string
  worker_id: string | null
  skills: Skill | null
  customer: { phone: string; profiles: { name: string | null } | null } | null
  rating: { score: number; comment: string | null } | null
  payments?: { id: string; status: string; payment_id: string }[]
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
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)

  // Stats
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)

  // ── Guard: Only workers can see this page ──────────────────
  useEffect(() => {
    if (!isLoggedIn || customer?.role !== 'worker') {
      navigate('/customer/dashboard', { replace: true })
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
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id, contact_name, contact_phone,
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
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id, contact_name, contact_phone,
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
          id, status, address, area, price, description, created_at, skill_id, customer_id, worker_id, contact_name, contact_phone,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name)),
          ratings!ratings_job_id_fkey (score, comment),
          payments (id, status, payment_id)
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
    fetchPaymentSettings().then(setPaymentSettings)
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
         
         // Admin Notification
         const skillName = job.skills?.name || 'a service'
         
         const host = window.location.hostname
         const adminPort = '3001'
         const adminUrl = `${window.location.protocol}//${host}:${adminPort}/jobs`

         notifyAdmin({
           message: `MistriJi: Worker ${customer?.name || 'Worker'} accepted ${skillName} in ${job.area}.`,
           link: adminUrl
         })
         
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

  // ── Complete Job Modal State ─────────────────────────────
  const [completeJobId, setCompleteJobId] = useState<string | null>(null)
  const [completePrice, setCompletePrice] = useState('')

  // ── Actions ──────────────────────────────────────────────
  async function handleAcceptJob(jobId: string) {
    setActioningId(jobId)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ worker_id: customer?.id, status: 'accepted' })
        .eq('id', jobId)
      
      if (error) throw error

      const { data: jobInfo } = await supabase.from('jobs').select('customer_id, contact_phone').eq('id', jobId).single()
      if (jobInfo?.customer_id) {
         await supabase.from('notifications').insert({
           user_id: jobInfo.customer_id,
           title: 'Job Update',
           message: 'Your service request has been accepted and a worker is assigned.',
           type: 'job_update',
           reference_id: jobId
         })
         
         // Notify Admin via Email and In-App
         notifyAdmin({
           message: `MistriJi: Job ${jobId.substring(0,6)} was ACCEPTED by worker ${customer?.name || 'Unknown'}.`,
           link: getAdminUrl('/jobs')
         })
         try {
           await supabase.rpc('notify_admins', {
             p_title: 'Job Accepted',
             p_message: `Job ${jobId.substring(0,6)} was ACCEPTED by worker ${customer?.name || 'Unknown'}.`,
             p_type: 'job_update',
             p_reference_id: jobId
           })
         } catch (notifErr) {
           console.error('Failed to create admin in-app notification', notifErr)
         }
      }

      await fetchJobs()
      toast.success('Job accepted! It is now in your Active jobs.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept job')
    } finally {
      setActioningId(null)
    }
  }

  async function handleSkipJob(jobId: string) {
    setActioningId(jobId)
    try {
      setIncomingJobs(prev => prev.filter(j => j.id !== jobId))
      toast.info('Job skipped')
    } finally {
      setActioningId(null)
    }
  }

  // ── Update Status ─────────────────────────────────────────
  async function handleStatusUpdate(jobId: string, newStatus: string, price?: number) {
    setActioningId(jobId)
    try {
      const updates: any = { status: newStatus }
      if (price !== undefined) {
        updates.price = price
      }
      const { error } = await supabase
        .from('jobs')
        .update(updates)
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
           notifyAdmin({
             message: `MistriJi: Job ${jobId.substring(0,6)} was marked as ${newStatus.toUpperCase()} by ${customer?.name || 'Worker'}.`,
             link: getAdminUrl('/jobs')
           })
           
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
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', paddingTop: '2rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        
        {paymentSettings?.workerPaymentsEnabled && (
          <div style={{ 
            background: 'linear-gradient(to right, #4f46e5, #9333ea)', 
            color: '#fff', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '0.75rem',
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(147, 51, 234, 0.15)'
          }}>
            <Zap size={16} style={{ flexShrink: 0 }} />
            <span><b>Earn More with MistriJi!</b> Subscribe to our commission model to receive direct digital payments and secure your bookings.</span>
          </div>
        )}

        {/* ── Premium Hero Card ─────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 50%, #312e81 100%)',
          borderRadius: '1.25rem',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.25)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top Row: Avatar & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 800,
                border: '2px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                textTransform: 'uppercase'
              }}>
                {customer?.name?.[0] || 'W'}
              </div>
              <div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {customer?.name || 'Worker'}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.35rem', background: 'rgba(5, 150, 105, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <HardHat size={12} /> VERIFIED PARTNER
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsSupportOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                <LifeBuoy size={14} /> Helpdesk / Tickets
              </button>

              <div 
                className="availability-toggle" 
                onClick={handleToggleAvailability}
                style={{
                  background: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${isAvailable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                  padding: '0.35rem 0.5rem 0.35rem 1rem',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isAvailable ? '#6ee7b7' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isAvailable ? 'On Duty' : 'Off Duty'}
                </span>
                <div style={{
                  width: '36px', height: '20px', borderRadius: '20px', background: isAvailable ? '#10b981' : '#4b5563', position: 'relative', transition: 'all 0.3s'
                }}>
                  <div style={{
                    position: 'absolute', top: '2px', left: isAvailable ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
            gap: '0.75rem' 
          }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{incomingJobs.length}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Requests</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{totalCompleted}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jobs Done</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: avgRating ? '#fbbf24' : '#fff', lineHeight: 1 }}>
                {avgRating ? `${avgRating}★` : '—'}
              </div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Rating</div>
            </div>
          </div>
        </div>

        {/* ── Premium Tab Bar ──────────────────────────────────────────── */}
        <div style={{ 
          display: 'flex', 
          background: '#ffffff', 
          borderRadius: '1rem', 
          padding: '0.5rem', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
          marginBottom: '2rem',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          gap: '0.5rem',
          overflowX: 'auto'
        }}>
          {[
            { id: 'incoming', label: 'Incoming', icon: Inbox, count: incomingJobs.length },
            { id: 'active', label: 'Active', icon: Briefcase, count: activeJobs.length },
            { id: 'history', label: 'History', icon: History, count: 0 }
          ].map(t => {
            const isActive = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '0.75rem',
                  background: isActive ? '#f8fafc' : 'transparent',
                  color: isActive ? '#4f46e5' : '#64748b',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.9rem',
                  border: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} style={{ color: isActive ? '#4f46e5' : '#94a3b8' }} />
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span style={{ 
                    background: isActive ? '#4f46e5' : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#475569',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
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
                          <User size={13} /> {job.contact_name || (job.customer as any)?.profiles?.name || 'Customer'}
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
                    const customerPhone = job.contact_phone || (job.customer as any)?.phone

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
                            <User size={13} /> {job.contact_name || (job.customer as any)?.profiles?.name || 'Customer'}
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
                              onClick={() => {
                                if (nextStatus === 'completed') {
                                  setCompleteJobId(job.id)
                                  setCompletePrice('')
                                } else {
                                  handleStatusUpdate(job.id, nextStatus)
                                }
                              }}
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
                            <User size={13} /> {job.contact_name || (job.customer as any)?.profiles?.name || 'Customer'}
                          </div>
                          {job.price && (
                            <div className="worker-job-detail-row">
                              <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>₹{job.price}</span>
                              {isCompleted && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  ...(job.payments && (job.payments as any[]).some((p: any) => p.status === 'captured')
                                    ? { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }
                                    : { background: '#fef9c3', color: '#92400e', border: '1px solid #fde047' }
                                  )
                                }}>
                                  {job.payments && (job.payments as any[]).some((p: any) => p.status === 'captured')
                                    ? '✅ Paid Online'
                                    : '💰 Cash / Pending'}
                                </span>
                              )}
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

      {/* ── Complete Job Modal ─────────────────────────────────────── */}
      {completeJobId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setCompleteJobId(null)}>
          <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '400px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✅</span> Complete Job
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Please enter the final amount (₹) charged for this service. This is required to process customer payments.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Total Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={completePrice}
                onChange={e => setCompletePrice(e.target.value)}
                placeholder="e.g. 500"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 700, color: '#1e1b4b', outline: 'none' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setCompleteJobId(null)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!completePrice || isNaN(Number(completePrice))) {
                    toast.error('Please enter a valid amount')
                    return
                  }
                  handleStatusUpdate(completeJobId, 'completed', Number(completePrice))
                  setCompleteJobId(null)
                }}
                disabled={actioningId === completeJobId}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#059669', color: '#ffffff', fontWeight: 700, cursor: 'pointer', opacity: actioningId === completeJobId ? 0.7 : 1 }}
              >
                {actioningId === completeJobId ? 'Updating...' : 'Submit & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Support & Ticket Modal */}
      <SupportTicketModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        forcedRole="worker"
      />
      </div>
    </div>
  )
}
