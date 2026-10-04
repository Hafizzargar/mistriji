import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { createPaymentOrder, verifyPayment, openRazorpayCheckout } from '@/api'
import { RefreshCw, LogIn, Phone, Clock, CheckCircle, ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { fetchPaymentSettings, PaymentSettings } from '@/lib/settings'

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

function VerticalTimeline({ status }: { status: string }) {
  if (status === 'cancelled') return null

  // Group steps for simpler UI
  const groups = [
    { key: 'received',   label: 'Request Received', icon: '📝', statuses: ['requested', 'pending_dispatch'] },
    { key: 'assigned',   label: 'Worker Assigned',  icon: '👷', statuses: ['accepted'] },
    { key: 'arriving',   label: 'Worker Arriving',  icon: '🚗', statuses: ['on_way', 'arrived'] },
    { key: 'working',    label: 'In Progress',      icon: '🔧', statuses: ['working'] },
    { key: 'completed',  label: 'Completed',        icon: '✅', statuses: ['completed'] }
  ]

  let currentGroupIdx = groups.findIndex(g => g.statuses.includes(status))
  if (currentGroupIdx === -1) currentGroupIdx = 0

  return (
    <div style={{ margin: '0.5rem 0 1rem 0' }}>
      {groups.map((g, i) => {
        const done = i <= currentGroupIdx
        const active = i === currentGroupIdx
        const isLast = i === groups.length - 1

        return (
          <div key={g.key} style={{ display: 'flex', gap: '1rem', position: 'relative', minHeight: '3.5rem' }}>
            {/* Timeline Line */}
            {!isLast && (
              <div style={{
                position: 'absolute', top: '2rem', left: '0.9rem', bottom: '-0.25rem', width: '2px',
                background: done ? 'linear-gradient(180deg, #4f46e5, #818cf8)' : '#e2e8f0', zIndex: 0
              }} />
            )}
            
            {/* Timeline Dot */}
            <div style={{
              width: '1.8rem', height: '1.8rem', borderRadius: '50%',
              background: active ? '#fff' : done ? '#4f46e5' : '#f8fafc',
              border: `2px solid ${active ? '#4f46e5' : done ? '#4f46e5' : '#e2e8f0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1, marginTop: '0.1rem',
              boxShadow: active ? '0 0 0 4px rgba(79,70,229,0.15)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {done && !active ? (
                <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>✓</span>
              ) : active ? (
                <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#4f46e5' }} />
              ) : null}
            </div>

            {/* Timeline Content */}
            <div style={{ paddingBottom: isLast ? '0' : '1.5rem', flex: 1, opacity: active || done ? 1 : 0.4 }}>
              <div style={{ fontWeight: active ? 800 : done ? 700 : 500, color: active ? '#1e1b4b' : done ? '#334155' : '#64748b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{g.icon}</span> {g.label}
              </div>
              {active && (
                <div style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '0.25rem', fontWeight: 700, background: '#e0e7ff', display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: '0.25rem' }}>
                  Current Status
                </div>
              )}
            </div>
          </div>
        )
      })}
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
  const { customer, isLoggedIn, openRoleModal, openLoginModal } = useCustomerAuth()

  const [phone, setPhone] = useState('')
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)

  // ── WORKER REDIRECT ────────────────────────────────────
  if (isLoggedIn && customer?.role === 'worker') {
    return <Navigate to="/worker/dashboard" replace />
  }

  useEffect(() => {
    fetchPaymentSettings().then(setPaymentSettings)
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

  useEffect(() => {
    if (!isLoggedIn) {
      openLoginModal()
    }
  }, [isLoggedIn, openLoginModal])

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

      // 1. Create order on backend
      const orderResult = await createPaymentOrder({
        amount: job.price * 100, // ₹ to paise
        currency: 'INR',
        userId: customer.id,
        jobId: job.id,
      })

      if (!orderResult.success || !orderResult.order_id) {
        throw new Error(orderResult.error || 'Failed to create order')
      }

      // 2. Open Razorpay Checkout
      openRazorpayCheckout({
        order_id:    orderResult.order_id,
        amount:      orderResult.amount!,
        currency:    orderResult.currency!,
        name:        'MistriJi',
        description: `Payment for ${job.skills?.name || 'Service'}`,
        prefill: {
          name:    customer.name || '',
          email:   customer.email || '',
          contact: customer.phone || ''
        },
        onSuccess: async (response) => {
          // 3. Verify payment signature on backend
          const verifyResult = await verifyPayment({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            userEmail: customer.email || null,
            userName:  customer.name  || null,
          })
          if (verifyResult.success) {
            toast.success('Payment successful!')
            fetchBookingsByUserId(customer.id)
          } else {
            toast.error(verifyResult.error || 'Payment verification failed.')
          }
        },
        onFailure: (description) => {
          toast.error('Payment failed: ' + description)
        },
      })

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
              <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '0.9rem' }}>🔒 Login Required</div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.2rem' }}>Please login to view your requests.</div>
            </div>
            <button onClick={openLoginModal} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
              <LogIn size={14} /> Login
            </button>
          </div>
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
                      {/* Timeline */}
                      <VerticalTimeline status={job.status} />

                      {/* Service info */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <CheckCircle size={20} style={{ color: '#065f46', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, color: '#065f46' }}>Job Completed ✓</div>
                              {job.price ? (
                                <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700 }}>Amount: ₹{job.price}</div>
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Amount not set yet</div>
                              )}
                            </div>
                          </div>
                          
                          {/* Payment Status */}
                          <div style={{ 
                            paddingTop: '0.75rem', 
                            borderTop: '1px dashed #6ee7b7',
                          }}>
                            {job.payments && job.payments.some(p => p.status === 'captured') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                                ✅ Paid Online Successfully
                              </div>
                            ) : job.price ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                  <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>💰 Payment Pending</span>
                                  {!paymentSettings?.customerPaymentsEnabled && (
                                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.15rem' }}>Pay by cash to your worker</div>
                                  )}
                                </div>
                                {paymentSettings?.customerPaymentsEnabled && (
                                  <button
                                    onClick={() => handlePayment(job)}
                                    disabled={loading}
                                    style={{
                                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '0.5rem 1.25rem',
                                      borderRadius: '0.625rem',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      cursor: loading ? 'not-allowed' : 'pointer',
                                      opacity: loading ? 0.7 : 1,
                                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                                    }}
                                  >
                                    💳 Pay ₹{job.price} Online
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
                                Waiting for worker to set the final amount…
                              </div>
                            )}
                          </div>
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
