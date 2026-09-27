import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { RefreshCw, LogIn, Phone, Clock, CheckCircle, ArrowLeft, ArrowRight, Plus } from 'lucide-react'

interface Skill { name: string; icon: string }

interface Job {
  id: string
  status: string
  address: string
  area: string
  price: number | null
  description?: string | null
  preferred_time?: string | null
  created_at: string
  skills: Skill | null
  worker: { phone: string; profiles: { name: string | null } | null } | null
  payments?: { id: string, status: string, payment_id: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Status pipeline configuration
// ─────────────────────────────────────────────────────────────────────────────
type PipelineStage = {
  status: string
  label: string
  shortLabel: string
  emoji: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}

const PIPELINE: PipelineStage[] = [
  { status: 'requested',       label: 'Request Received',   shortLabel: 'Received',   emoji: '📝', color: '#92400e', bgColor: '#fef9c3', borderColor: '#fde047', description: 'Your request has been received.' },
  { status: 'pending_dispatch',label: 'Admin Reviewing',    shortLabel: 'Reviewing',  emoji: '👨‍💼', color: '#1e40af', bgColor: '#dbeafe', borderColor: '#93c5fd', description: 'Our team is reviewing your request.' },
  { status: 'accepted',        label: 'Worker Assigned',    shortLabel: 'Assigned',   emoji: '👷', color: '#065f46', bgColor: '#d1fae5', borderColor: '#6ee7b7', description: 'A verified worker has been assigned to your job.' },
  { status: 'on_way',          label: 'Worker On The Way',  shortLabel: 'On Way',     emoji: '🚗', color: '#1e3a8a', bgColor: '#e0f2fe', borderColor: '#38bdf8', description: 'Your worker is on the way to your location.' },
  { status: 'arrived',         label: 'Worker Arrived',     shortLabel: 'Arrived',    emoji: '📍', color: '#1e3a8a', bgColor: '#e0f2fe', borderColor: '#38bdf8', description: 'The worker has arrived at your location.' },
  { status: 'working',         label: 'Work In Progress',   shortLabel: 'In Progress',emoji: '🔧', color: '#3730a3', bgColor: '#ede9fe', borderColor: '#a78bfa', description: 'Work is currently in progress.' },
  { status: 'completed',       label: 'Work Completed',     shortLabel: 'Completed',  emoji: '✅', color: '#065f46', bgColor: '#d1fae5', borderColor: '#6ee7b7', description: 'The job has been completed successfully.' },
  { status: 'cancelled',       label: 'Cancelled',          shortLabel: 'Cancelled',  emoji: '❌', color: '#991b1b', bgColor: '#fee2e2', borderColor: '#f87171', description: 'This request was cancelled.' },
]

function getStage(status: string): PipelineStage {
  return PIPELINE.find(p => p.status === status) ?? {
    status,
    label: status.replace(/_/g, ' '),
    shortLabel: status.replace(/_/g, ' '),
    emoji: '🔄',
    color: '#374151',
    bgColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    description: '',
  }
}

// Progress bar — ordered pipeline steps (excluding cancelled)
const ORDERED_STEPS = ['requested', 'pending_dispatch', 'accepted', 'on_way', 'arrived', 'working', 'completed']

function ProgressBar({ status }: { status: string }) {
  if (status === 'cancelled') return null
  const currentIdx = ORDERED_STEPS.indexOf(status)

  return (
    <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
        {/* Track line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: '#e5e7eb', transform: 'translateY(-50%)', zIndex: 0 }} />
        <div style={{
          position: 'absolute', top: '50%', left: 0, height: 3,
          width: `${Math.max(0, (currentIdx / (ORDERED_STEPS.length - 1)) * 100)}%`,
          background: 'linear-gradient(90deg, #4f46e5, #818cf8)',
          transform: 'translateY(-50%)', zIndex: 1, transition: 'width 0.3s ease',
          borderRadius: 99,
        }} />
        {ORDERED_STEPS.map((s, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <div key={s} style={{ flex: 1, display: 'flex', justifyContent: i === 0 ? 'flex-start' : i === ORDERED_STEPS.length - 1 ? 'flex-end' : 'center', position: 'relative', zIndex: 2 }}>
              <div style={{
                width: active ? 20 : 12, height: active ? 20 : 12,
                borderRadius: '50%',
                background: done ? '#4f46e5' : '#fff',
                border: `2px solid ${done ? '#4f46e5' : '#d1d5db'}`,
                boxShadow: active ? '0 0 0 4px rgba(79,70,229,0.25)' : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.6rem', fontWeight: 800
              }}>
                {done && !active ? '✓' : ''}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.625rem' }}>
        {ORDERED_STEPS.map((s, i) => {
          const stage = PIPELINE.find(p => p.status === s)!
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <div key={s} style={{ flex: 1, textAlign: i === 0 ? 'left' : i === ORDERED_STEPS.length - 1 ? 'right' : 'center', display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === ORDERED_STEPS.length - 1 ? 'flex-end' : 'center' }}>
              <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>
                {stage.emoji}
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: active ? 800 : done ? 700 : 500,
                color: active ? '#4f46e5' : done ? '#374151' : '#9ca3af',
                marginTop: '0.2rem',
                lineHeight: 1.15,
                whiteSpace: 'nowrap'
              }}>
                {stage.shortLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function shortId(uuid: string) {
  return 'MST-' + uuid.replace(/-/g, '').slice(0, 6).toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function MyBookingsPage() {
  const toast = useToast()
  const { customer, isLoggedIn, openRoleModal } = useCustomerAuth()

  const [phone, setPhone] = useState('')
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // ── WORKER REDIRECT ────────────────────────────────────
  if (isLoggedIn && customer?.role === 'worker') {
    return <Navigate to="/worker" replace />
  }

  useEffect(() => {
    if (isLoggedIn && customer) {
      if (customer.phone) {
        setPhone(customer.phone)
        setSubmittedPhone(customer.phone)
      }
      setUserId(customer.id)
      fetchBookingsByUserId(customer.id)
    }
  }, [isLoggedIn, customer])

  // ── Realtime Updates ────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('customer_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `customer_id=eq.${userId}` },
        () => fetchBookingsByUserId(userId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function fetchBookingsByUserId(uid: string) {
    setLoading(true)
    try {
      let { data, error } = await supabase
        .from('jobs')
        .select(`
          id, status, address, area, price, description, preferred_time, created_at,
          skills (name, icon),
          worker:users!jobs_worker_id_fkey (phone, profiles (name)),
          payments (id, status, payment_id)
        `)
        .eq('customer_id', uid)
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs((data ?? []) as unknown as Job[])
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch requests')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMyBookings(custPhone: string) {
    setLoading(true)
    try {
      const { data: user } = await supabase
        .from('users').select('id').eq('phone', custPhone).maybeSingle()
      if (!user) { setJobs([]); setUserId(null); setLoading(false); return }
      
      setUserId(user.id)
      await fetchBookingsByUserId(user.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch user requests')
      setLoading(false)
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  async function handlePayment(job: Job) {
    if (!customer || !job.price) return

    setLoading(true)
    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        toast.error('Failed to load payment gateway. Please check your internet connection.')
        setLoading(false)
        return
      }

      // 1. Create order on our backend
      const res = await fetch('http://localhost:3002/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: job.price * 100, // convert ₹ to paise
          currency: 'INR',
          userId: customer.id,
          jobId: job.id,
          workerId: job.worker ? null : null, // (We don't easily have worker_id here, but we can pass it if we select it)
        })
      })

      const orderData = await res.json()
      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'dummy_key', 
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'MistriJi',
        description: `Payment for ${job.skills?.name || 'Service'}`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          // 3. Verify payment on our backend
          try {
            const verifyRes = await fetch('http://localhost:3002/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userEmail: customer.email || null,
                userName: customer.name || null
              })
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              toast.success('Payment successful!')
              fetchBookingsByUserId(customer.id) // refresh
            } else {
              toast.error(verifyData.error || 'Payment verification failed.')
            }
          } catch (err: any) {
            toast.error('Payment verification failed.')
          }
        },
        prefill: {
          name: customer.name || '',
          email: customer.email || '',
          contact: customer.phone || ''
        },
        theme: {
          color: '#4f46e5'
        }
      }

      // @ts-ignore
      const rzp1 = new window.Razorpay(options)
      rzp1.on('payment.failed', function (response: any) {
        toast.error('Payment failed: ' + response.error.description)
      })
      rzp1.open()

    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const clean = phone.replace(/\D/g, '').slice(-10)
    if (clean.length !== 10) { toast.error('Enter a valid 10-digit phone number.'); return }
    setSubmittedPhone(clean)
    fetchMyBookings(clean)
  }

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: 760 }}>
      {/* Header with Navigation */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#4f46e5', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <ArrowLeft size={15} /> Back to Home
          </a>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
            My Service Requests
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
            Track the status of your submitted service requests in real time.
          </p>
        </div>
        <a href="/" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, textDecoration: 'none', borderRadius: '0.75rem', padding: '0.5rem 1rem' }}>
          <Plus size={15} /> New Request
        </a>
      </div>

      {/* Guest phone lookup */}
      {!isLoggedIn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #eef2ff, #fdf4ff)',
            border: '1.5px solid #c7d2fe',
            borderRadius: '1rem',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '0.9rem' }}>🔒 Login to auto-load your requests</div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.2rem' }}>Or enter your phone number below to look up requests.</div>
            </div>
            <button onClick={openRoleModal} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
              <LogIn size={14} /> Login
            </button>
          </div>

          <form onSubmit={handleSearch} style={{
            background: '#fff', padding: '1.5rem', borderRadius: '1rem',
            border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
              Your Registered Mobile Number
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flex: 1 }}>
                <span style={{ padding: '0.625rem 0.75rem', background: '#f3f4f6', border: '1.5px solid #d1d5db', borderRight: 'none', borderRadius: '0.5rem 0 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>+91</span>
                <input
                  type="tel" inputMode="numeric" maxLength={10} placeholder="98xxxxxxxx"
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="input" style={{ borderRadius: '0 0.5rem 0.5rem 0' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontWeight: 700 }}>
                {loading ? 'Searching…' : 'Find Requests'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      {submittedPhone && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1b4b' }}>
              {jobs.length} Request{jobs.length !== 1 ? 's' : ''} Found
            </h3>
            <button className="btn btn-sm btn-secondary" onClick={() => fetchMyBookings(submittedPhone)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2].map(i => (
                <div key={i} style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #e5e7eb', opacity: 0.6 }}>
                  <div style={{ height: 20, width: '40%', background: '#f3f4f6', borderRadius: 8, marginBottom: '0.75rem' }} />
                  <div style={{ height: 14, width: '60%', background: '#f3f4f6', borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
              <h4 style={{ fontWeight: 700, color: '#1e1b4b' }}>No requests found</h4>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                No service requests for this phone number yet.
              </p>
              <a href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, textDecoration: 'none' }}>
                Submit a Request →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {jobs.map(job => {
                const stage = getStage(job.status)
                const isCancelled = job.status === 'cancelled'
                const isCompleted = job.status === 'completed'
                const workerAssigned = !!job.worker

                return (
                  <div key={job.id} style={{
                    background: '#fff',
                    borderRadius: '1.25rem',
                    border: `1.5px solid ${stage.borderColor}`,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                  }}>
                    {/* Status banner */}
                    <div style={{ background: stage.bgColor, borderBottom: `1px solid ${stage.borderColor}`, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{stage.emoji}</span>
                        <span style={{ fontWeight: 800, color: stage.color, fontSize: '0.9rem' }}>{stage.label}</span>
                        {!isCancelled && !isCompleted && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color, animation: 'pulse 1.5s infinite', opacity: 0.7 }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: stage.color, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{shortId(job.id)}</span>
                    </div>

                    <div style={{ padding: '1.25rem' }}>
                      {/* Progress bar */}
                      <ProgressBar status={job.status} />

                      {/* Service info */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{job.skills?.icon || '🔧'}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e1b4b' }}>{job.skills?.name || 'Service Request'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span>📍 {job.area}</span>
                            {job.address && job.address !== job.area && <span>• {job.address}</span>}
                            <span>• {new Date(job.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {job.description && (
                        <div style={{ marginTop: '0.875rem', fontSize: '0.825rem', color: '#374151', background: '#f8fafc', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', lineHeight: 1.55 }}>
                          📝 {job.description}
                        </div>
                      )}

                      {/* Preferred time */}
                      {job.preferred_time && (
                        <div style={{ marginTop: '0.625rem', fontSize: '0.8rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Clock size={13} style={{ color: '#4f46e5' }} />
                          <strong>Preferred:</strong> {new Date(job.preferred_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      )}

                      {/* Status-specific messages */}
                      {job.status === 'requested' && (
                        <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#92400e', fontWeight: 500 }}>
                          ⏳ Request received — our team is reviewing and will assign a verified worker shortly.
                        </div>
                      )}

                      {job.status === 'pending_dispatch' && (
                        <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#1e40af', fontWeight: 500 }}>
                          👨‍💼 Our admin team is selecting the best available worker in your area.
                        </div>
                      )}

                      {workerAssigned && job.status !== 'requested' && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem 1.25rem',
                          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                          border: '1.5px solid #86efac',
                          borderRadius: '1rem',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontSize: '1.35rem' }}>👷</span>
                              <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#047857' }}>
                                  Assigned Technician
                                </div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#064e3b' }}>
                                  {job.worker?.profiles?.name || 'Mistri Verified Professional'}
                                </div>
                              </div>
                            </div>
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              ✓ Confirmed
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px dashed #bbf7d0',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontSize: '0.9rem', fontWeight: 700 }}>
                              <Phone size={15} style={{ color: '#059669' }} />
                              <span>+91 {job.worker?.phone?.replace(/^(\+91|91)/, '').slice(-10) || '—'}</span>
                            </div>

                            {job.worker?.phone && (
                              <a
                                href={`tel:+91${job.worker.phone.replace(/^(\+91|91)/, '').slice(-10)}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  background: '#059669',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  padding: '0.45rem 0.9rem',
                                  borderRadius: '0.625rem',
                                  textDecoration: 'none',
                                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Phone size={14} /> Call Technician
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {isCompleted && (
                        <div style={{ marginTop: '0.875rem', padding: '0.875rem', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: job.price ? '0.75rem' : '0' }}>
                            <CheckCircle size={20} style={{ color: '#065f46', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, color: '#065f46' }}>Job Completed ✓</div>
                              {job.price && <div style={{ fontSize: '0.8rem', color: '#166534' }}>Amount: ₹{job.price}</div>}
                            </div>
                          </div>
                          
                          {/* Payment Section */}
                          {job.price && (
                            <div style={{ 
                              paddingTop: '0.75rem', 
                              borderTop: '1px dashed #6ee7b7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              {job.payments && job.payments.some(p => p.status === 'captured') ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                                  ✅ Paid Successfully
                                </div>
                              ) : (
                                <>
                                  <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Payment Pending</span>
                                  <button
                                    onClick={() => handlePayment(job)}
                                    disabled={loading}
                                    style={{
                                      background: '#4f46e5',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '0.4rem 1rem',
                                      borderRadius: '0.5rem',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      cursor: loading ? 'not-allowed' : 'pointer',
                                      opacity: loading ? 0.7 : 1,
                                      boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                                    }}
                                  >
                                    Pay ₹{job.price} Now
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
