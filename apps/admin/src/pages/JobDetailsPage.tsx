import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, RefreshCw, Trash2, Phone, MapPin, ChevronDown, Search, X, Clock, Edit } from 'lucide-react'
import { JAMMU_AREAS } from '@/lib/jammuCoordinates'
import { logAdminAction } from '@/lib/auditLogger'

export function JobDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false)
  const [workerSearch, setWorkerSearch] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editData, setEditData] = useState({ area: '', address: '', price: '', description: '' })

  const { user: currentAdmin } = useAuth()
  const toast = useToast()

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData(isRefresh = false) {
    if (!id) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // 1. Fetch Job
      const { data: jobData, error: jobErr } = await supabase
        .from('jobs')
        .select(`
          *,
          skills(id, name, icon),
          customer:users!jobs_customer_id_fkey(id, phone, role, profiles(name, area, city, district)),
          worker:users!jobs_worker_id_fkey(id, phone, role, profiles(name, area, city, district))
        `)
        .eq('id', id)
        .single()

      if (jobErr) throw jobErr
      setJob(jobData)

      // 2. Fetch Skills
      const { data: skillsData } = await supabase.from('skills').select('*').order('name')
      if (skillsData) setSkills(skillsData)

      // 3. Fetch Workers
      const { data: workersData } = await supabase
        .from('users')
        .select(`
          id, phone, role,
          profiles(name, area, city, district),
          worker_skills(skill_id)
        `)
        .eq('role', 'worker')

      if (workersData) setWorkers(workersData)

    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!job) return
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Status updated to ${newStatus}`)
      setJob({ ...job, status: newStatus })
      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Status Updated',
        targetType: 'job',
        targetId: job.id,
        details: `updated status of job to "${newStatus}"`,
        oldValue: job.status,
        newValue: newStatus
      })
    }
  }

  async function handleServiceChange(newSkillId: string) {
    if (!job) return
    const newSkill = skills.find(s => s.id === newSkillId)
    
    let targetWorkerId = job.worker_id
    let newStatus = job.status
    let unassigned = false

    if (targetWorkerId) {
      const assignedW = workers.find(w => w.id === targetWorkerId)
      const hasNewSkill = assignedW?.worker_skills?.some((ws: any) => ws.skill_id === newSkillId)
      
      if (!hasNewSkill) {
        targetWorkerId = null
        unassigned = true
        if (['accepted', 'on_way', 'arrived', 'working'].includes(job.status)) {
          newStatus = 'pending_dispatch'
        }
      }
    }

    const updates: any = { skill_id: newSkillId }
    if (unassigned) {
      updates.worker_id = null
      updates.status = newStatus
    }

    const { error } = await supabase.from('jobs').update(updates).eq('id', job.id)
    if (error) {
      toast.error(error.message)
    } else {
      if (unassigned) {
        toast.success(`Service changed to ${newSkill?.name} and previous worker was unassigned because they lacked the skill.`)
      } else {
        toast.success(`Service changed to ${newSkill?.name}`)
      }
      setJob({ ...job, skill_id: newSkillId, skills: newSkill, worker_id: targetWorkerId, status: newStatus })
      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Service Updated',
        targetType: 'job',
        targetId: job.id,
        details: `updated service of job to "${newSkill?.name}"${unassigned ? ' (worker unassigned)' : ''}`,
        oldValue: job.skill_id,
        newValue: newSkillId
      })
    }
  }

  async function handleAssignWorker(newWorkerId: string) {
    if (!job) return
    const targetWorkerId = newWorkerId === '' ? null : newWorkerId
    
    // Automatically update status to correct database enum based on assignment
    let newStatus = job.status
    if (targetWorkerId && (job.status === 'requested' || job.status === 'pending_dispatch' || job.status === 'accepted')) {
      newStatus = 'accepted'
    } else if (!targetWorkerId && (job.status === 'accepted' || job.status === 'on_way' || job.status === 'arrived' || job.status === 'working')) {
      newStatus = 'pending_dispatch'
    }

    const { error } = await supabase.from('jobs').update({ 
      worker_id: targetWorkerId,
      status: newStatus 
    }).eq('id', job.id)
    
    if (error) {
      toast.error(error.message)
    } else {
      if (newStatus !== job.status) {
        toast.success(targetWorkerId ? 'Worker assigned & status updated' : 'Worker unassigned & status updated')
      } else {
        toast.success(targetWorkerId ? 'Worker assigned successfully' : 'Worker unassigned')
      }
      const targetWorker = workers.find(w => w.id === targetWorkerId)
      setJob({ ...job, worker_id: targetWorkerId, worker: targetWorker, status: newStatus })
      await logAdminAction({
        actor: currentAdmin,
        action: targetWorkerId ? 'Worker Assigned' : 'Worker Unassigned',
        targetType: 'job',
        targetId: job.id,
        details: targetWorkerId 
          ? `assigned worker ${targetWorker?.profiles?.name || targetWorker?.phone} and set status to ${newStatus}` 
          : `unassigned worker from job and set status to ${newStatus}`
      })
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div className="spinner" style={{ color: 'var(--brand-500)' }} />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚫</div>
        <div className="empty-state-title">Job Not Found</div>
        <div className="empty-state-desc">This job booking may have been deleted or does not exist.</div>
        <Link to="/jobs" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Jobs</Link>
      </div>
    )
  }

  // Calculate worker dropdown options
  const jobArea = job.area?.toLowerCase() || ''
  const custProfiles = job.customer?.profiles
  const custArea = custProfiles?.area?.toLowerCase() || ''
  const custDist = custProfiles?.district?.toLowerCase() || ''
  const custCity = custProfiles?.city?.toLowerCase() || ''

  let targetDist = custDist
  const mappedDist = JAMMU_AREAS[jobArea]?.district?.toLowerCase()
  if (mappedDist) {
    targetDist = mappedDist
  } else {
    const ALL_DISTRICTS = ['jammu', 'samba', 'kathua', 'udhampur', 'reasi', 'rajouri', 'poonch', 'doda', 'ramban', 'kishtwar']
    for (const d of ALL_DISTRICTS) {
      if (jobArea.includes(d)) {
        targetDist = d
        break
      }
    }
  }

  let regionalWorkers = workers.filter(w => {
    const p = w.profiles
    if (!p) return false
    const wAreaRaw = p.area || ''
    const wArea = wAreaRaw.toLowerCase()
    const wDist = p.district?.toLowerCase() || ''
    const wCity = p.city?.toLowerCase() || ''

    // Strict District Isolation: worker MUST be from the target district
    if (targetDist) {
      let inferredWorkerDist = wDist
      if (!inferredWorkerDist && wAreaRaw) {
        inferredWorkerDist = JAMMU_AREAS[wAreaRaw]?.district?.toLowerCase() || ''
      }
      const knownLocs = [wDist, inferredWorkerDist, wCity, wArea].filter(Boolean)
      if (knownLocs.length > 0) {
        const hasMatch = knownLocs.some(loc => loc === targetDist || loc.includes(targetDist) || targetDist.includes(loc))
        if (!hasMatch) return false // STRICT ISOLATION
      }
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

  const assignedWorker = workers.find(w => w.id === job.worker_id)
  if (assignedWorker && !regionalWorkers.find(w => w.id === assignedWorker.id)) {
    regionalWorkers = [assignedWorker, ...regionalWorkers]
  }

  const areaName = job.area || ''
  const district = JAMMU_AREAS[areaName]?.district || job.customer?.profiles?.district || ''
  const address = job.address || ''
  const isSame = areaName.toLowerCase() === district.toLowerCase()

  async function handleDeleteJob() {
    if (!job) return
    setDeleting(true)

    try {
      // Manual cascade to bypass any restrictive DB constraints
      await supabase.from('ratings').delete().eq('job_id', job.id)
      await supabase.from('job_claims').delete().eq('job_id', job.id)

      const { error } = await supabase.from('jobs').delete().eq('id', job.id)
      if (error) throw error

      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Booking Deleted',
        targetType: 'job',
        targetId: job.id,
        details: `permanently deleted job booking #${job.id.slice(0, 8)}`,
      })

      toast.success('Job booking deleted')
      navigate('/jobs')
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
      setDeleting(false)
    }
  }

  function openEditModal() {
    setEditData({
      area: job.area || '',
      address: job.address || '',
      price: job.price?.toString() || '',
      description: job.description || ''
    })
    setShowEditModal(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const updates = {
        area: editData.area,
        address: editData.address,
        price: editData.price ? parseInt(editData.price) : 0,
        description: editData.description
      }
      const { error } = await supabase.from('jobs').update(updates).eq('id', job.id)
      if (error) throw error

      setJob({ ...job, ...updates })
      setShowEditModal(false)
      toast.success('Job details updated')

      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Details Updated',
        targetType: 'job',
        targetId: job.id,
        details: 'updated area/address/price/description'
      })
    } catch (err: any) {
      toast.error('Update failed: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Link to="/jobs" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                <ArrowLeft size={14} /> Back to Jobs
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.25px' }}>
                Job #{job.id.slice(0, 8)}
              </h1>
              <span style={{ fontSize: '0.65rem', background: job.status === 'completed' ? '#dcfce7' : job.status === 'cancelled' ? '#fee2e2' : '#e0e7ff', color: job.status === 'completed' ? '#166534' : job.status === 'cancelled' ? '#991b1b' : '#3730a3', padding: '0.15rem 0.4rem', borderRadius: '1rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {job.status.replace('_', ' ')}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={12} /> {new Date(job.created_at).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => fetchData(true)} disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '1px solid #e2e8f0',
              padding: '0.3rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569',
              cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refresh...' : 'Refresh'}
          </button>
          <button
            onClick={openEditModal}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#eff6ff', border: '1px solid #bfdbfe',
              padding: '0.3rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#2563eb',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Edit size={12} /> Edit Details
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fef2f2', border: '1px solid #fecaca',
              padding: '0.3rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#dc2626',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Service & Price */}
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 2px 10px rgba(15,23,42,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Service Required</label>
                <div style={{ position: 'relative' }}>
                  <select
                    style={{
                      fontSize: '0.95rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '0.5rem',
                      background: '#fff', color: '#0f172a', padding: '0.5rem 0.75rem', width: '100%',
                      cursor: 'pointer', outline: 'none', appearance: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    value={job.skill_id}
                    onChange={e => handleServiceChange(e.target.value)}
                  >
                    {skills
                      .sort((a, b) => {
                        if (a.name.toLowerCase() === 'other') return 1;
                        if (b.name.toLowerCase() === 'other') return -1;
                        return a.name.localeCompare(b.name);
                      })
                      .map(s => (
                        <option
                          key={s.id}
                          value={s.id}
                          style={s.name.toLowerCase() === 'other' ? { color: '#64748b' } : {}}
                        >
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <ChevronDown size={14} color="#64748b" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Price</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>₹{job.price ?? 0}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Payment</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  {job.payment_method?.toUpperCase() || 'CASH'} • <span style={{ color: job.payment_status === 'paid' ? '#10b981' : '#b45309' }}>{job.payment_status?.toUpperCase() || 'UNPAID'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Location */}
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(15,23,42,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Customer Details
            </div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem', marginBottom: '0.2rem' }}>
              {job.customer?.profiles?.name ?? 'Customer'}
            </div>
            <div style={{ color: '#4f46e5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '1rem' }}>
              <Phone size={14} /> +91 {job.customer?.phone}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  District
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {district || '-'}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Area
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <MapPin size={12} color="#64748b" /> {job.area || '-'}
                </div>
              </div>
            </div>
            {job.address && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Address:</span> {job.address}
              </div>
            )}
          </div>

          {/* Work Description */}
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(15,23,42,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Work Description
            </div>
            <div style={{ fontSize: '0.9rem', color: job.description ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {job.description || 'No additional description provided.'}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Actions & Assignment */}
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(15,23,42,0.02)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Update Job Status
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={job.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  style={{
                    width: '100%', height: '38px', padding: '0 2rem 0 0.75rem', fontSize: '0.85rem', fontWeight: 600,
                    border: '1px solid #cbd5e1', borderRadius: '0.5rem', background: '#fff',
                    color: '#0f172a', outline: 'none', cursor: 'pointer', appearance: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="requested">🟡 Requested</option>
                  <option value="pending_dispatch">🟠 Admin Reviewing</option>
                  <option value="accepted">🔵 Worker Assigned</option>
                  <option value="on_way">🟣 On Way</option>
                  <option value="arrived">🟣 Arrived</option>
                  <option value="working">🟣 Working</option>
                  <option value="completed">🟢 Completed</option>
                  <option value="cancelled">🔴 Cancelled</option>
                </select>
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <ChevronDown size={14} color="#64748b" />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Assign Worker
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setWorkerDropdownOpen(!workerDropdownOpen)}
                  style={{
                    width: '100%', height: '38px', padding: '0 0.75rem', fontSize: '0.85rem', fontWeight: 600,
                    border: '1px solid #cbd5e1', borderRadius: '0.5rem', background: '#fff',
                    color: '#0f172a', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.worker_id ? (
                      <React.Fragment>
                        👷 {workers.find(w => w.id === job.worker_id)?.profiles?.name || workers.find(w => w.id === job.worker_id)?.phone}
                      </React.Fragment>
                    ) : (
                      '-- Tap to Assign Worker --'
                    )}
                  </span>
                  <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
                </button>

                {workerDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem',
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                    zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    maxHeight: '260px', width: '250px'
                  }}>
                    <div style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', background: '#f8fafc' }}>
                      <Search size={14} color="#64748b" style={{ marginLeft: '0.4rem' }} />
                      <input
                        type="text"
                        placeholder="Search workers..."
                        value={workerSearch}
                        onChange={e => setWorkerSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', padding: '0.4rem', width: '100%', fontSize: '0.85rem' }}
                        autoFocus
                      />
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem' }}>
                      <div
                        onClick={() => { handleAssignWorker(''); setWorkerDropdownOpen(false); setWorkerSearch(''); }}
                        style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}
                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        -- Unassigned --
                      </div>

                      {(() => {
                        const searchStr = workerSearch.toLowerCase();
                        const filterWorkers = (list: any[]) => {
                          if (!searchStr) return list;
                          return list.filter(w => {
                            const name = (w.profiles?.name || '').toLowerCase();
                            const phone = (w.phone || '').toLowerCase();
                            return name.includes(searchStr) || phone.includes(searchStr);
                          });
                        };

                        // Only show workers who have the selected skill
                        const filteredWorkers = filterWorkers(regionalWorkers).filter(w => w.worker_skills?.some((ws: any) => ws.skill_id === job.skill_id));

                        return (
                          <React.Fragment>
                            {filteredWorkers.length > 0 && (
                              <div style={{ marginTop: '0.25rem' }}>
                                {filteredWorkers.map(w => {
                                  const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
                                  return (
                                    <div
                                      key={w.id}
                                      onClick={() => { handleAssignWorker(w.id); setWorkerDropdownOpen(false); setWorkerSearch(''); }}
                                      style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', fontSize: '0.85rem', color: '#0f172a', fontWeight: 500, background: job.worker_id === w.id ? '#eef2ff' : 'transparent' }}
                                      onMouseOver={e => e.currentTarget.style.background = job.worker_id === w.id ? '#eef2ff' : '#f8fafc'}
                                      onMouseOut={e => e.currentTarget.style.background = job.worker_id === w.id ? '#eef2ff' : 'transparent'}
                                    >
                                      👷 {w.profiles?.name || w.phone} {wLoc && <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 400 }}>({wLoc})</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </React.Fragment>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setShowDeleteModal(false)}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trash2 size={16} /> Delete Booking</h3>
              <button onClick={() => setShowDeleteModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete this job booking request? This cannot be undone.
            </div>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteJob} disabled={deleting} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowEditModal(false)} />
          <div style={{ background: '#fff', borderRadius: '0.75rem', width: '100%', maxWidth: '450px', position: 'relative', zIndex: 10, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Edit Job Details</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Area (Jammu & Kashmir)</label>
                <select value={editData.area} onChange={e => setEditData({ ...editData, area: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} required>
                  <option value="">Select Area...</option>
                  {Object.values(JAMMU_AREAS).map(area => (
                    <option key={area.name} value={area.name}>{area.name} ({area.description})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Detailed Address</label>
                <input type="text" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} placeholder="E.g., House No 123, Sector 4" style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Job Price (₹)</label>
                <input type="number" value={editData.price} onChange={e => setEditData({ ...editData, price: e.target.value })} placeholder="0.00 (Optional)" style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Work Description</label>
                <textarea value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Describe the issue or work required..." rows={3} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', resize: 'vertical', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '0.6rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingEdit} style={{ flex: 2, padding: '0.6rem', background: '#4f46e5', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 600, cursor: savingEdit ? 'not-allowed' : 'pointer' }}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
