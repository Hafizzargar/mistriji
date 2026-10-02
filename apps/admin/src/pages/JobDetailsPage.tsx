import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, RefreshCw, Trash2, Phone, MapPin } from 'lucide-react'
import { JAMMU_AREAS } from '@/lib/config'

export function JobDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const { currentAdmin, logAdminAction } = useAuth()
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
    const { error } = await supabase.from('jobs').update({ skill_id: newSkillId }).eq('id', job.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Service changed to ${newSkill?.name}`)
      setJob({ ...job, skill_id: newSkillId, skills: newSkill })
      await logAdminAction({
        actor: currentAdmin,
        action: 'Job Service Updated',
        targetType: 'job',
        targetId: job.id,
        details: `updated service of job to "${newSkill?.name}"`,
        oldValue: job.skill_id,
        newValue: newSkillId
      })
    }
  }

  async function handleAssignWorker(newWorkerId: string) {
    if (!job) return
    const targetWorkerId = newWorkerId === '' ? null : newWorkerId
    const { error } = await supabase.from('jobs').update({ worker_id: targetWorkerId }).eq('id', job.id)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(targetWorkerId ? 'Worker assigned successfully' : 'Worker unassigned')
      const targetWorker = workers.find(w => w.id === targetWorkerId)
      setJob({ ...job, worker_id: targetWorkerId, worker: targetWorker })
      await logAdminAction({
        actor: currentAdmin,
        action: targetWorkerId ? 'Worker Assigned' : 'Worker Unassigned',
        targetType: 'job',
        targetId: job.id,
        details: targetWorkerId 
          ? `assigned worker ${targetWorker?.profiles?.name || targetWorker?.phone}` 
          : `unassigned worker from job`
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
  const ALL_DISTRICTS = ['jammu', 'samba', 'kathua', 'udhampur', 'reasi', 'rajouri', 'poonch', 'doda', 'ramban', 'kishtwar']
  for (const d of ALL_DISTRICTS) {
    if (jobArea.includes(d)) {
      targetDist = d
      break
    }
  }

  let regionalWorkers = workers.filter(w => {
    const p = w.profiles
    if (!p) return false
    const wArea = p.area?.toLowerCase() || ''
    const wDist = p.district?.toLowerCase() || ''
    const wCity = p.city?.toLowerCase() || ''
    
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

  const assignedWorker = workers.find(w => w.id === job.worker_id)
  if (assignedWorker && !regionalWorkers.find(w => w.id === assignedWorker.id)) {
    regionalWorkers = [assignedWorker, ...regionalWorkers]
  }
  
  const matchingSkillWorkers = regionalWorkers.filter(w => w.worker_skills?.some((ws: any) => ws.skill_id === job.skill_id))
  const otherSkillWorkers = regionalWorkers.filter(w => !matchingSkillWorkers.find(mw => mw.id === w.id))

  const areaName = job.area || ''
  const district = JAMMU_AREAS[areaName]?.district || job.customer?.profiles?.district || ''
  const address = job.address || ''
  const isSame = areaName.toLowerCase() === district.toLowerCase()

  async function handleDeleteJob() {
    if (!job) return
    if (!window.confirm('Are you sure you want to delete this job booking request? This cannot be undone.')) return

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
      window.close() // Close the tab if they deleted the job
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => window.close()} className="btn btn-secondary" title="Close Tab">
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="page-title">
              <select
                style={{ fontSize: '1.5rem', fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'inherit', padding: 0, cursor: 'pointer' }}
                value={job.skill_id}
                onChange={e => handleServiceChange(e.target.value)}
              >
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </h1>
            <p className="page-subtitle">Job ID: #{job.id.slice(0, 8)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-danger" onClick={handleDeleteJob}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Customer</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.25rem', fontSize: '1.1rem' }}>{job.customer?.profiles?.name ?? 'Customer'}</div>
            <div style={{ color: '#475569', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
              <Phone size={14} /> +91 {job.customer?.phone}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <MapPin size={16} /> {isSame ? areaName : `${areaName}, ${district}`}
            </div>
            {address && address.toLowerCase() !== areaName.toLowerCase() && (
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>{address}</div>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Work Details & Description</div>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem', fontSize: '0.9rem', color: job.description ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
            {job.description || 'No description provided.'}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Update Status</div>
            <select
              className="input"
              value={job.status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ padding: '0.625rem', fontSize: '0.9rem' }}
            >
              <option value="pending">🟡 Pending (New)</option>
              <option value="admin_reviewing">🟠 Admin Reviewing</option>
              <option value="assigned">🔵 Assigned</option>
              <option value="in_progress">🟣 In Progress</option>
              <option value="completed">🟢 Completed</option>
              <option value="cancelled">🔴 Cancelled</option>
            </select>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Assign Worker</div>
            <select
              className="input"
              style={{ padding: '0.625rem', fontSize: '0.9rem' }}
              value={job.worker_id ?? ''}
              onChange={e => handleAssignWorker(e.target.value)}
            >
              <option value="">-- Unassigned --</option>
              {matchingSkillWorkers.length > 0 && (
                <optgroup label="Nearby Workers (Matching Skill)">
                  {matchingSkillWorkers.map(w => {
                    const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
                    return (
                      <option key={w.id} value={w.id}>
                        👷 {w.profiles?.name || w.phone} {wLoc ? `(${wLoc})` : ''}
                      </option>
                    )
                  })}
                </optgroup>
              )}
              {otherSkillWorkers.length > 0 && (
                <optgroup label="Nearby Workers (Other Skills)">
                  {otherSkillWorkers.map(w => {
                    const wLoc = [w.profiles?.city, w.profiles?.district].filter(Boolean).join(', ')
                    const wSkillsText = w.worker_skills?.map((ws: any) => skills.find(s => s.id === ws.skill_id)?.name).filter(Boolean).join(', ') || 'No Skills'
                    return (
                      <option key={w.id} value={w.id}>
                        👷 {w.profiles?.name || w.phone} - {wSkillsText} {wLoc ? `(${wLoc})` : ''}
                      </option>
                    )
                  })}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Price & Payment</div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', color: '#16a34a', marginTop: '0.25rem' }}>₹{job.price ?? 0}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              Method: <strong style={{ color: '#0f172a' }}>{job.payment_method?.toUpperCase() || 'CASH'}</strong> • Status: <strong style={{ color: '#0f172a' }}>{job.payment_status?.toUpperCase() || 'UNPAID'}</strong>
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Timing Details</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#334155' }}>
              <span style={{ color: '#64748b' }}>Requested:</span> <strong>{new Date(job.created_at).toLocaleString()}</strong>
            </div>
            {job.preferred_time && (
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#334155' }}>
                <span style={{ color: '#64748b' }}>Preferred:</span> <strong>{new Date(job.preferred_time).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
