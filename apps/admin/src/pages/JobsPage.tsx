import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { logAdminAction } from '@/lib/auditLogger'
import { useToast } from '@/contexts/ToastContext'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Briefcase, Plus, Trash2, Edit3, X, RefreshCw, UserCheck } from 'lucide-react'
import { JAMMU_AREAS } from '@/lib/jammuCoordinates'

type JobStatus = 'requested' | 'pending_dispatch' | 'accepted' | 'on_way' | 'arrived' | 'working' | 'completed' | 'cancelled'

interface Skill { id: string; name: string; icon: string }
interface SimpleUser { id: string; phone: string; profiles: { name: string; area?: string; district?: string; city?: string } | null }

interface Job {
  id: string
  status: JobStatus
  address: string
  area: string
  description?: string | null

  price: number | null
  created_at: string
  skill_id: string
  customer_id: string
  worker_id: string | null
  payment_method?: string | null
  payment_status?: string | null
  preferred_time?: string | null
  skills: { name: string; icon: string } | null
  customer: { profiles: { name: string } | null; phone: string; email?: string | null } | null
  worker: { profiles: { name: string } | null; phone: string; email?: string | null } | null
}

const STATUS_CONFIG: Record<JobStatus, { label: string; cls: string }> = {
  requested:        { label: '🕐 Requested',       cls: 'badge-neutral' },
  pending_dispatch: { label: '👨‍💼 Admin Reviewing', cls: 'badge-info' },
  accepted:         { label: '✅ Worker Assigned',  cls: 'badge-info' },
  on_way:           { label: '🚗 On Way',           cls: 'badge-brand' },
  arrived:          { label: '📍 Arrived',          cls: 'badge-warning' },
  working:          { label: '🔧 Working',          cls: 'badge-warning' },
  completed:        { label: '✓ Completed',         cls: 'badge-success' },
  cancelled:        { label: '✗ Cancelled',         cls: 'badge-error' },
}

export function JobsPage() {
  const toast                       = useToast()
  const { user: currentAdmin }      = useAuth()
  const [jobs, setJobs]             = useState<Job[]>([])
  const [skills, setSkills]         = useState<Skill[]>([])
  const [customers, setCustomers]   = useState<SimpleUser[]>([])
  const [workers, setWorkers]       = useState<SimpleUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<JobStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalJobs, setTotalJobs] = useState(0)

  // Modal state
  const [showModal, setShowModal]   = useState(false)
  const [skillId, setSkillId]       = useState('')
  const [customerId, setCustomerId] = useState('')
  const [workerId, setWorkerId]     = useState('')
  const [area, setArea]             = useState('Gandhi Nagar')
  const [address, setAddress]       = useState('')
  const [price, setPrice]           = useState('500')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Delete and View state
  const [deletingJob, setDeletingJob] = useState<Job | null>(null)
  const [viewingJob, setViewingJob] = useState<Job | null>(null)

  async function fetchJobs(nextPage = currentPage, nextPageSize = pageSize, nextFilter = filter) {
    setLoading(true)
    let q = supabase
      .from('jobs')
      .select(`
        id, status, address, area, description, price, created_at, skill_id, customer_id, worker_id, payment_method, payment_status, preferred_time,
        skills (name, icon),
        customer:users!jobs_customer_id_fkey (phone, email, profiles (name, area, district, city)),
        worker:users!jobs_worker_id_fkey (phone, email, profiles (name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((nextPage - 1) * nextPageSize, nextPage * nextPageSize - 1)

    if (nextFilter !== 'all') q = q.eq('status', nextFilter)
    const { data, count, error } = await q
    if (error) {
      toast.error(error.message)
      setJobs([])
      setTotalJobs(0)
      setLoading(false)
      return
    }

    setJobs((data ?? []) as unknown as Job[])
    setTotalJobs(count ?? (data ?? []).length)
    setLoading(false)
  }

  async function fetchDropdownData() {
    const { data: sk } = await supabase.from('skills').select('id, name, icon').eq('is_active', true)
    setSkills(sk ?? [])

    const { data: cust } = await supabase
      .from('users')
      .select('id, phone, profiles(name)')
      .eq('role', 'customer')
    setCustomers((cust ?? []) as unknown as SimpleUser[])

    const { data: wrk } = await supabase
      .from('users')
      .select('id, phone, profiles(name, area, district, city), worker_skills(skill_id)')
      .eq('role', 'worker')
    setWorkers((wrk ?? []) as unknown as SimpleUser[])
  }

  useEffect(() => {
    setCurrentPage(1)
    fetchJobs(1, pageSize, filter)
    fetchDropdownData()
  }, [filter])

  useEffect(() => {
    fetchJobs(currentPage, pageSize, filter)
  }, [currentPage, pageSize])

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showModal || viewingJob || deletingJob) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [showModal, viewingJob, deletingJob])

  async function handleStatusChange(jobId: string, newStatus: JobStatus) {
    const targetJob = jobs.find(j => j.id === jobId)
    const { error: err } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId)
    if (err) {
      toast.error(err.message)
    } else {
      toast.success(`Job status changed to ${newStatus}`)
      await fetchJobs()

      const jobIdentifier = targetJob ? `#${targetJob.id.slice(0, 8)} (${targetJob.skills?.name || 'Job'})` : `#${jobId.slice(0, 8)}`
      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Status Updated',
        targetType: 'job',
        targetId: jobId,
        details: `updated status of job ${jobIdentifier} to "${newStatus}"`,
        oldValue: targetJob?.status,
        newValue: newStatus
      })
    }
  }

  async function notifyCustomerWorkerAssigned(jobId: string) {
    try {
      const { data: jData } = await supabase
        .from('jobs')
        .select(`
          id, area, address, preferred_time,
          skills (name),
          customer:users!jobs_customer_id_fkey (email, phone, profiles(name)),
          worker:users!jobs_worker_id_fkey (email, phone, profiles(name))
        `)
        .eq('id', jobId)
        .single()

      const cust = (jData as any)?.customer
      const wrk = (jData as any)?.worker
      const custEmail = cust?.email
      if (!custEmail) return

      const workerName = wrk?.profiles?.name || 'Mistri Verified Professional'
      const workerPhone = wrk?.phone || 'Not Available'
      const serviceName = (jData as any)?.skills?.name || 'Home Service'
      const shortJobId = 'MST-' + jobId.replace(/-/g, '').slice(0, 6).toUpperCase()

      await fetch('http://localhost:3002/api/notify/customer-assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: custEmail,
          customerName: cust?.profiles?.name || 'Customer',
          serviceName,
          jobId: shortJobId,
          workerName,
          workerPhone,
          area: (jData as any)?.area,
          address: (jData as any)?.address,
          preferredTime: (jData as any)?.preferred_time,
          trackingUrl: 'http://localhost:3000/my-bookings'
        })
      })
    } catch (err) {
      console.warn('Could not dispatch customer assignment notification:', err)
    }
  }

  async function handleAssignWorker(jobId: string, wId: string) {
    const newStatus: JobStatus = wId ? 'accepted' : 'pending_dispatch'
    const targetJob = jobs.find(j => j.id === jobId)
    const targetWorker = workers.find(w => w.id === wId)
    const workerName = (targetWorker as any)?.profiles?.name || (targetWorker?.phone ? `+91 ${targetWorker.phone}` : 'Worker')
    
    const { error: err } = await supabase
      .from('jobs')
      .update({ worker_id: wId || null, status: newStatus })
      .eq('id', jobId)
      
    if (err) {
      toast.error(err.message)
    } else {
      toast.success(wId ? 'Worker assigned and status updated!' : 'Worker unassigned')
      await fetchJobs()

      if (wId) {
        notifyCustomerWorkerAssigned(jobId)
      }

      const jobIdentifier = targetJob ? `#${targetJob.id.slice(0, 8)} (${targetJob.skills?.name || 'Job'})` : `#${jobId.slice(0, 8)}`
      await logAdminAction({
        actor: currentAdmin,
        action: wId ? 'Worker Assigned to Job' : 'Worker Unassigned from Job',
        targetType: 'job',
        targetId: jobId,
        details: wId
          ? `assigned worker "${workerName}" to job ${jobIdentifier}`
          : `unassigned worker from job ${jobIdentifier}`,
        newValue: wId || null
      })
    }
  }

  function openCreateModal() {
    setSkillId(skills[0]?.id ?? '')
    setCustomerId(customers[0]?.id ?? '')
    setWorkerId('')
    setArea('Gandhi Nagar')
    setAddress('House #12, Block B')
    setPrice('500')
    setError('')
    setShowModal(true)
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault()
    if (!skillId || !customerId) {
      toast.error('Please select a service and a customer.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const { data: createdData, error: err } = await supabase.from('jobs').insert({
        skill_id: skillId,
        customer_id: customerId,
        worker_id: workerId || null,
        area,
        address,
        price: Number(price) || 0,
        status: workerId ? 'accepted' : 'requested',
      }).select().single()

      if (err) throw err
      toast.success('Job booking created successfully!')
      setShowModal(false)
      await fetchJobs()

      const selectedSkill = skills.find(s => s.id === skillId)
      const selectedCustomer = customers.find(c => c.id === customerId)
      const custName = (selectedCustomer as any)?.profiles?.name || (selectedCustomer?.phone ? `+91 ${selectedCustomer.phone}` : 'Customer')
      
      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Booking Created',
        targetType: 'job',
        targetId: createdData?.id,
        details: `created a manual booking for ${selectedSkill?.name || 'Service'} in ${area} for customer "${custName}" (₹${price})`,
        newValue: createdData
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to create job booking.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteJob() {
    if (!deletingJob) return
    try {
      const deletedJobId = deletingJob.id
      const jobDesc = `${deletingJob.skills?.name || 'Job'} for ${(deletingJob.customer as any)?.profiles?.name || 'Customer'}`
      
      // Manual cascade to bypass any restrictive DB constraints
      await supabase.from('ratings').delete().eq('job_id', deletingJob.id)
      await supabase.from('job_claims').delete().eq('job_id', deletingJob.id)

      const { error } = await supabase.from('jobs').delete().eq('id', deletingJob.id)
      if (error) throw error
      toast.success('Job booking deleted')
      setDeletingJob(null)
      await fetchJobs()

      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Booking Deleted',
        targetType: 'job',
        targetId: deletedJobId,
        details: `permanently deleted job booking #${deletedJobId.slice(0, 8)} (${jobDesc})`,
      })
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }

  const columns: Column<Job>[] = [
    {
      key: 'service',
      header: 'Service',
      searchValue: j => `${j.skills?.name ?? ''} ${j.skills?.icon ?? ''}`,
      render: j => (
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>{j.skills?.icon}</span>
            <span>{j.skills?.name ?? '—'}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, opacity: 0.7 }}>🕒</span>
            {new Date(j.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Customer',
      searchValue: j => `${(j.customer as any)?.profiles?.name ?? ''} ${(j.customer as any)?.phone ?? ''}`,
      render: j => (
        <div style={{ color: 'var(--gray-700)' }}>
          <div style={{ fontWeight: 600 }}>{(j.customer as any)?.profiles?.name ?? 'Customer'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>+91 {(j.customer as any)?.phone}</div>
        </div>
      )
    },
    {
      key: 'worker',
      header: 'Assigned Worker',
      searchValue: j => `${(j.worker as any)?.profiles?.name ?? ''} ${(j.worker as any)?.phone ?? ''}`,
      render: j => {
        const jobArea = j.area?.toLowerCase() || ''
        const jobSkillId = j.skill_id
        
        const custProfiles = (j.customer as any)?.profiles
        const custArea = custProfiles?.area?.toLowerCase() || ''
        const custDist = custProfiles?.district?.toLowerCase() || ''
        const custCity = custProfiles?.city?.toLowerCase() || ''
        
        // Find workers who have the skill AND are in the EXACT SAME area/district/city
        let matchingWorkers = workers.filter(w => {
          const hasSkill = (w as any).worker_skills?.some((ws: any) => ws.skill_id === jobSkillId)
          if (!hasSkill) return false

          const p = w.profiles
          if (!p) return false
          const wArea = p.area?.toLowerCase() || ''
          const wDist = p.district?.toLowerCase() || ''
          const wCity = p.city?.toLowerCase() || ''
          
          // Infer the absolute target district for this job
          let targetDist = custDist
          const ALL_DISTRICTS = ['jammu', 'samba', 'kathua', 'udhampur', 'reasi', 'rajouri', 'poonch', 'doda', 'ramban', 'kishtwar']
          for (const d of ALL_DISTRICTS) {
            if (jobArea.includes(d)) {
              targetDist = d
              break
            }
          }

          // Strict District Isolation: If we know the target district, worker MUST be from there
          if (targetDist && wDist && wDist !== targetDist && !wDist.includes(targetDist) && !targetDist.includes(wDist)) {
            return false
          }

          // Check if any of the location fields overlap
          const distMatch = (wDist && custDist && (wDist === custDist || wDist.includes(custDist) || custDist.includes(wDist))) || false
          const cityMatch = (wCity && custCity && (wCity === custCity || wCity.includes(custCity) || custCity.includes(wCity))) || false
          const areaMatch = (wArea && custArea && (wArea === custArea || wArea.includes(custArea) || custArea.includes(wArea))) || false
          
          // Fallback check against the raw text typed in job's area field (in case customer profile doesn't have district)
          const jobTextMatch = jobArea ? (
                 (wArea && (wArea.includes(jobArea) || jobArea.includes(wArea))) ||
                 (wDist && (wDist.includes(jobArea) || jobArea.includes(wDist))) ||
                 (wCity && (wCity.includes(jobArea) || jobArea.includes(wCity)))
          ) : false

          return distMatch || cityMatch || areaMatch || jobTextMatch
        })

        // Always include the currently assigned worker, even if they don't match the location
        const assignedWorker = workers.find(w => w.id === j.worker_id)
        if (assignedWorker && !matchingWorkers.find(w => w.id === assignedWorker.id)) {
          matchingWorkers = [assignedWorker, ...matchingWorkers]
        }
        
        return (
          <select
            className="input"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minWidth: 140 }}
            value={j.worker_id ?? ''}
            onChange={e => handleAssignWorker(j.id, e.target.value)}
          >
            <option value="">-- Unassigned --</option>
            {matchingWorkers.map(w => {
              const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
              return (
                <option key={w.id} value={w.id}>
                  👷 {w.profiles?.name || w.phone} {wLoc ? `(${wLoc})` : ''}
                </option>
              )
            })}
          </select>
        )
      }
    },
    // Removed work_details and price columns per user request
    {
      key: 'status',
      header: 'Status',
      render: j => (
        <select
          className="input"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}
          value={j.status}
          onChange={e => handleStatusChange(j.id, e.target.value as JobStatus)}
        >
          <option value="requested">🕐 Requested</option>
          <option value="pending_dispatch">👨‍💼 Admin Reviewing</option>
          <option value="accepted">✅ Worker Assigned</option>
          <option value="on_way">🚗 On Way</option>
          <option value="arrived">📍 Arrived</option>
          <option value="working">🔧 Working</option>
          <option value="completed">✓ Completed</option>
          <option value="cancelled">✗ Cancelled</option>
        </select>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: j => (
        <button className="btn btn-sm btn-secondary" onClick={() => setViewingJob(j)} title="View Details">
          View Details
        </button>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs & Bookings</h1>
          <p className="page-subtitle">Manage customer service requests and worker assignments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => fetchJobs(currentPage, pageSize, filter)} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Create Booking
          </button>
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['all', 'requested', 'pending_dispatch', 'accepted', 'on_way', 'working', 'completed', 'cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
            {f === 'all' ? 'All' : STATUS_CONFIG[f as JobStatus]?.label ?? f}
          </button>
        ))}
      </div>

      <DataTable
        data={jobs}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search jobs by customer, worker, address, skill…"
        defaultPageSize={10}
        emptyMessage="No jobs found"
        emptyIcon="💼"
        serverPagination={{
          totalCount: totalJobs,
          currentPage,
          pageSize,
          onPageChange: (page) => setCurrentPage(page),
          onPageSizeChange: (size) => {
            setPageSize(size)
            setCurrentPage(1)
          },
        }}
      />

      {/* Create Job Modal */}
      {showModal && (
        <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Create Job Booking</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Dispatch manual service order on behalf of customer</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={modalStyles.closeBtn} title="Close"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={modalStyles.body}>
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    {error}
                  </div>
                )}

                <div>
                  <label className="label">Service / Skill Required *</label>
                  <select className="input" value={skillId} onChange={e => setSkillId(e.target.value)} required>
                    {skills.map(s => (
                      <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="label">Customer *</label>
                    <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                      {customers.length === 0 && <option value="">No customers found</option>}
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>👤 {c.profiles?.name || c.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Assign Worker (Optional)</label>
                    <select className="input" value={workerId} onChange={e => setWorkerId(e.target.value)}>
                      <option value="">-- Leave Unassigned --</option>
                      {workers.filter(w => {
                         if (skillId && !(w as any).worker_skills?.some((ws: any) => ws.skill_id === skillId)) return false
                         
                         const cust = customers.find(c => c.id === customerId)
                         const custArea = (cust as any)?.profiles?.area?.toLowerCase() || ''
                         const custDist = (cust as any)?.profiles?.district?.toLowerCase() || ''
                         const custCity = (cust as any)?.profiles?.city?.toLowerCase() || ''
                         
                         const p = w.profiles
                         if (!p) return false
                         const wArea = p.area?.toLowerCase() || ''
                         const wDist = p.district?.toLowerCase() || ''
                         const wCity = p.city?.toLowerCase() || ''
                         
                         const typedArea = area.toLowerCase()

                         const distMatch = (wDist && custDist && (wDist === custDist || wDist.includes(custDist) || custDist.includes(wDist))) || false
                         const cityMatch = (wCity && custCity && (wCity === custCity || wCity.includes(custCity) || custCity.includes(wCity))) || false
                         const areaMatch = (wArea && custArea && (wArea === custArea || wArea.includes(custArea) || custArea.includes(wArea))) || false

                         const typedTextMatch = 
                                (wArea && (wArea.includes(typedArea) || typedArea.includes(wArea))) ||
                                (wDist && (wDist.includes(typedArea) || typedArea.includes(wDist))) ||
                                (wCity && (wCity.includes(typedArea) || typedArea.includes(wCity)))

                         return distMatch || cityMatch || areaMatch || typedTextMatch
                      }).map(w => {
                        const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
                        return (
                          <option key={w.id} value={w.id}>
                            👷 {w.profiles?.name || w.phone} {wLoc ? `(${wLoc})` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="label">Area in Jammu *</label>
                    <input className="input" value={area} onChange={e => setArea(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Price (₹) *</label>
                    <input type="number" className="input" value={price} onChange={e => setPrice(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className="label">Full Address *</label>
                  <input className="input" value={address} onChange={e => setAddress(e.target.value)} required />
                </div>
              </div>

              <div style={modalStyles.footer}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingJob && (
        <div style={modalStyles.overlay} onClick={() => setDeletingJob(null)}>
          <div style={{ ...modalStyles.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#991b1b' }}>Delete Booking?</h3>
              </div>
              <button onClick={() => setDeletingJob(null)} style={modalStyles.closeBtn}><X size={16} /></button>
            </div>
            <div style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete this job booking request? This cannot be undone.
            </div>
            <div style={modalStyles.footer}>
              <button className="btn btn-secondary" onClick={() => setDeletingJob(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteJob}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingJob && (
        <div style={modalStyles.overlay} onClick={() => setViewingJob(null)}>
          <div style={{ ...modalStyles.card, maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  {viewingJob.skills?.icon || '🔧'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {viewingJob.skills?.name ?? 'Job Booking Details'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Job ID: #{viewingJob.id.slice(0, 8)} • 📍 {viewingJob.area}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingJob(null)} style={modalStyles.closeBtn} title="Close"><X size={18} /></button>
            </div>

            <div style={modalStyles.body}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', background: '#f8fafc', padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Customer</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{(viewingJob.customer as any)?.profiles?.name ?? 'Customer'}</div>
                  <div style={{ color: '#475569', fontSize: '0.8rem' }}>+91 {(viewingJob.customer as any)?.phone}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
                  {(() => {
                    const areaName = viewingJob.area || ''
                    const district = JAMMU_AREAS[areaName]?.district || (viewingJob.customer as any)?.profiles?.district || ''
                    const address = viewingJob.address || ''
                    const isSame = areaName.toLowerCase() === district.toLowerCase()
                    return (
                      <>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                          📍 {isSame ? areaName : `${areaName}, ${district}`}
                        </div>
                        {address && address.toLowerCase() !== areaName.toLowerCase() && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>{address}</div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Work Details & Description</div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                  {viewingJob.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No description provided.</span>}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Update Status</div>
                  <select
                    className="input"
                    style={{ fontWeight: 600 }}
                    value={viewingJob.status}
                    onChange={e => {
                      handleStatusChange(viewingJob.id, e.target.value as JobStatus)
                      setViewingJob({ ...viewingJob, status: e.target.value as JobStatus })
                    }}
                  >
                    <option value="requested">🕐 Requested</option>
                    <option value="pending_dispatch">👨‍💼 Admin Reviewing</option>
                    <option value="accepted">✅ Worker Assigned</option>
                    <option value="on_way">🚗 On Way</option>
                    <option value="arrived">📍 Arrived</option>
                    <option value="working">🔧 Working</option>
                    <option value="completed">✓ Completed</option>
                    <option value="cancelled">✗ Cancelled</option>
                  </select>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Assign Worker</div>
                  <select
                    className="input"
                    value={viewingJob.worker_id ?? ''}
                    onChange={e => {
                      handleAssignWorker(viewingJob.id, e.target.value)
                      setViewingJob({ ...viewingJob, worker_id: e.target.value })
                    }}
                  >
                    <option value="">-- Unassigned --</option>
                    {(() => {
                      const jobArea = viewingJob.area?.toLowerCase() || ''
                      const jobSkillId = viewingJob.skill_id
                      
                      const custProfiles = (viewingJob.customer as any)?.profiles
                      const custArea = custProfiles?.area?.toLowerCase() || ''
                      const custDist = custProfiles?.district?.toLowerCase() || ''
                      const custCity = custProfiles?.city?.toLowerCase() || ''
                      
                      let matching = workers.filter(w => {
                        const hasSkill = (w as any).worker_skills?.some((ws: any) => ws.skill_id === jobSkillId)
                        if (!hasSkill) return false

                        const p = w.profiles
                        if (!p) return false
                        const wArea = p.area?.toLowerCase() || ''
                        const wDist = p.district?.toLowerCase() || ''
                        const wCity = p.city?.toLowerCase() || ''
                        
                        // Infer the absolute target district for this job
                        let targetDist = custDist
                        const ALL_DISTRICTS = ['jammu', 'samba', 'kathua', 'udhampur', 'reasi', 'rajouri', 'poonch', 'doda', 'ramban', 'kishtwar']
                        for (const d of ALL_DISTRICTS) {
                          if (jobArea.includes(d)) {
                            targetDist = d
                            break
                          }
                        }

                        // Strict District Isolation
                        if (targetDist && wDist && wDist !== targetDist && !wDist.includes(targetDist) && !targetDist.includes(wDist)) {
                          return false
                        }

                        const distMatch = (wDist && custDist && (wDist === custDist || wDist.includes(custDist) || custDist.includes(wDist))) || false
                        const cityMatch = (wCity && custCity && (wCity === custCity || wCity.includes(custCity) || custCity.includes(wCity))) || false
                        const areaMatch = (wArea && custArea && (wArea === custArea || wArea.includes(custArea) || custArea.includes(wArea))) || false
                        
                        const jobTextMatch = jobArea ? (
                               (wArea && (wArea.includes(jobArea) || jobArea.includes(wArea))) ||
                               (wDist && (wDist.includes(jobArea) || jobArea.includes(wDist))) ||
                               (wCity && (wCity.includes(jobArea) || jobArea.includes(wCity)))
                        ) : false

                        return distMatch || cityMatch || areaMatch || jobTextMatch
                      })

                      const assignedWorker = workers.find(w => w.id === viewingJob.worker_id)
                      if (assignedWorker && !matching.find(w => w.id === assignedWorker.id)) {
                        matching = [assignedWorker, ...matching]
                      }

                      return matching.map(w => {
                        const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
                        return (
                          <option key={w.id} value={w.id}>
                            👷 {w.profiles?.name || w.phone} {wLoc ? `(${wLoc})` : ''}
                          </option>
                        )
                      })
                    })()}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Price & Payment</div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#16a34a', marginTop: '0.15rem' }}>₹{viewingJob.price ?? 0}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Method: <strong style={{ color: '#0f172a' }}>{viewingJob.payment_method?.toUpperCase() || 'CASH'}</strong> • Status: <strong style={{ color: '#0f172a' }}>{viewingJob.payment_status?.toUpperCase() || 'UNPAID'}</strong>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Timing Details</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.15rem', color: '#334155' }}>
                    <span style={{ color: '#64748b' }}>Requested:</span> <strong>{new Date(viewingJob.created_at).toLocaleString()}</strong>
                  </div>
                  {viewingJob.preferred_time && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.1rem', color: '#334155' }}>
                      <span style={{ color: '#64748b' }}>Preferred:</span> <strong>{new Date(viewingJob.preferred_time).toLocaleString()}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={modalStyles.footer}>
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { setDeletingJob(viewingJob); setViewingJob(null) }}>
                <Trash2 size={15} /> Delete Job
              </button>
              <button className="btn btn-secondary" onClick={() => setViewingJob(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '0.875rem',
    width: '100%',
    maxWidth: 540,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    flexShrink: 0,
  },
  body: {
    padding: '1.25rem',
    overflowY: 'auto' as const,
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
  },
  footer: {
    padding: '0.875rem 1.25rem',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    width: 28,
    height: 28,
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    transition: 'all 0.15s ease',
  },
}
