import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { MapPin, Clock, Phone, HardHat, CheckCircle2, ChevronDown, User, IndianRupee } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface JobFeedItem {
  id: string
  customer_id: string
  requested_worker_id: string | null
  skill_id: string
  status: string
  area: string
  address: string
  price: number
  preferred_time: string | null
  created_at: string
  contact_name: string | null
  contact_phone: string | null
  customers: {
    profiles: { name: string; phone: string } | null
    phone: string
  } | null
  skills: { name: string } | null
}

interface WorkerOption {
  id: string
  phone: string
  name: string
  area: string
  skills: string[]
}

export function AdminDispatchPage() {
  const { customer, isLoggedIn } = useCustomerAuth()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [jobs, setJobs] = useState<JobFeedItem[]>([])
  const [workers, setWorkers] = useState<WorkerOption[]>([])
  const [loading, setLoading] = useState(true)

  // Redirect non-admins or non-logged in users
  useEffect(() => {
    if (!isLoggedIn || (customer?.role !== 'admin' && customer?.role !== 'super_admin')) {
      navigate('/', { replace: true })
    }
  }, [customer, isLoggedIn, navigate])

  // Fetch initial data
  useEffect(() => {
    if (customer?.role !== 'admin' && customer?.role !== 'super_admin') return
    
    const fetchData = async () => {
      try {
        // Fetch pending dispatch and requested jobs
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select(`
            id, customer_id, requested_worker_id, skill_id, status, area, address, price, preferred_time, created_at, contact_name, contact_phone,
            customers:users!jobs_customer_id_fkey( phone, profiles(name) ),
            skills(name)
          `)
          .in('status', ['pending_dispatch', 'requested'])
          .order('created_at', { ascending: false })

        if (jobsErr) throw jobsErr
        setJobs(jobsData as any || [])

        // Fetch all active workers for the assignment dropdown
        const { data: workersData, error: wrkErr } = await supabase
          .from('users')
          .select(`
            id, phone,
            profiles(name, area),
            worker_skills( skills(name) )
          `)
          .eq('role', 'worker')
          .eq('status', 'active')

        if (wrkErr) throw wrkErr

        const formattedWorkers = (workersData || []).map((w: any) => ({
          id: w.id,
          phone: w.phone,
          name: w.profiles?.name || 'Worker',
          area: w.profiles?.area || 'Jammu',
          skills: w.worker_skills?.map((ws: any) => ws.skills?.name).filter(Boolean) || []
        }))
        setWorkers(formattedWorkers)

      } catch (err: any) {
        toast.error('Failed to load dispatch data: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // Realtime subscription for incoming jobs
    const subscription = supabase
      .channel('admin_dispatch_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async (payload) => {
        const newJob = payload.new as JobFeedItem
        // If job became assigned/completed/cancelled, remove it
        if (!['pending_dispatch', 'requested'].includes(newJob.status)) {
          setJobs(prev => prev.filter(j => j.id !== newJob.id))
          return
        }

        // Fetch full relationships for new/updated job
        const { data } = await supabase
          .from('jobs')
          .select(`
            id, customer_id, requested_worker_id, skill_id, status, area, address, price, preferred_time, created_at,
            customers:users!jobs_customer_id_fkey( phone, profiles(name) ),
            skills(name)
          `)
          .eq('id', newJob.id)
          .single()

        if (data) {
          setJobs(prev => {
            const exists = prev.find(j => j.id === data.id)
            if (exists) return prev.map(j => j.id === data.id ? data as any : j)
            // Play notification sound
            try { new Audio('/notification.mp3').play().catch(() => {}) } catch(e){}
            return [data as any, ...prev]
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [customer, toast])

  const handleAssignJob = async (jobId: string, workerId: string) => {
    if (!workerId) return
    try {
      const { data, error } = await supabase.rpc('admin_assign_job', {
        p_job_id: jobId,
        p_worker_id: workerId
      })
      if (error) throw error
      if (data) {
        toast.success('Job assigned successfully!')
        const job = jobs.find(j => j.id === jobId)
        if (job) {
          if (job.customer_id) {
             const custMsg = 'Our dispatch team has assigned a worker to your request.'
             supabase.from('notifications').insert({
               user_id: job.customer_id,
               title: 'Worker Assigned',
               message: custMsg,
               type: 'booking_alert',
               reference_id: jobId
             }).then()
             // Customer relies on in-app bell notification
          }
          const workerMsg = 'Admin has directly assigned a new job to you. Check Active Jobs.'
          supabase.from('notifications').insert({
            user_id: workerId,
            title: 'New Job Assigned!',
            message: workerMsg,
            type: 'booking_alert',
            reference_id: jobId
          }).then()
          
          // Note: worker phone isn't directly in this scope easily, so we only SMS the customer for now.
        }
        setJobs(prev => prev.filter(j => j.id !== jobId))
      } else {
        toast.error('Could not assign job. It may have already been accepted.')
      }
    } catch (err: any) {
      toast.error('Assignment failed: ' + err.message)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="loading loading-spinner loading-lg"></span></div>
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HardHat size={28} style={{ color: 'var(--brand-600)' }} />
            Live Dispatch Control
          </h1>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.25rem' }}>Monitor and assign incoming bookings in real-time.</p>
        </div>
        <div className="badge badge-error gap-2" style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          Live Feed Active
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--gray-300)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--gray-500)' }}>Inbox Zero!</h3>
          <p style={{ color: 'var(--gray-400)' }}>No pending bookings to dispatch right now.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {jobs.map(job => (
            <div key={job.id} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: job.status === 'pending_dispatch' ? '#fffbeb' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${job.status === 'pending_dispatch' ? 'badge-warning' : 'badge-primary'} badge-sm font-bold`} style={{ fontSize: '0.7rem' }}>
                  {job.status === 'pending_dispatch' ? 'Manual Dispatch Required' : 'Auto-Broadcast Running'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={12} />
                  {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '1rem' }}>
                  {job.skills?.name || 'General Service'}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <User size={16} style={{ color: 'var(--gray-400)', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                        {job.contact_name || job.customers?.profiles?.name || 'Customer'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Phone size={12} /> {job.contact_phone || job.customers?.phone || 'No phone'}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <MapPin size={16} style={{ color: 'var(--gray-400)', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-800)' }}>{job.area}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{job.address}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <IndianRupee size={16} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-800)' }}>₹{job.price}</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.5rem', display: 'block' }}>
                    Assign to Worker:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      className="select select-bordered select-sm flex-1" 
                      id={`worker-select-${job.id}`}
                      defaultValue=""
                    >
                      <option value="" disabled>Select a Mistri...</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.area}) - {w.skills.join(', ')}
                        </option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const select = document.getElementById(`worker-select-${job.id}`) as HTMLSelectElement
                        handleAssignJob(job.id, select.value)
                      }}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
