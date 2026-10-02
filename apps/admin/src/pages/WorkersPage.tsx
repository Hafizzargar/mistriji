import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { logAdminAction } from '@/lib/auditLogger'
import { DataTable, Column } from '@/components/ui/DataTable'
import { PlusCircle, Edit3, Trash2, UserCheck, RefreshCw, Star, Briefcase, Eye, X, Award, Ban, CheckCircle, ArrowLeft, ShieldCheck, ChevronRight } from 'lucide-react'
import { JAMMU_AREAS, JAMMU_DISTRICT_OPTIONS, getAreasForDistrict } from '@/lib/jammuCoordinates'

type VerificationStatus = 'pending' | 'verified' | 'rejected'
type PhoneType = 'smartphone' | 'keypad' | 'none'
type FilterType = 'all' | 'pending' | 'verified' | 'rejected' | 'disabled'

interface RatingItem {
  score: number
  comment: string | null
  created_at: string
}

interface JobItem {
  id: string
  status: string
  area: string
  address: string
  price: number | null
  created_at: string
  skills: { name: string; icon: string } | null
  customer: { profiles: { name: string } | null; phone: string } | null
}

interface Worker {
  id: string
  phone: string
  email: string | null
  status: string
  suspension_reason?: string | null
  created_at: string
  profiles: { name: string; area: string; photo_url: string | null } | null
  worker_profiles: {
    verification_status: VerificationStatus
    is_available: boolean
    experience_years: number
    phone_type: PhoneType
    enrollment_method: string
  } | null
  worker_skills: Array<{ skill_id?: string; skills: { id?: string; name: string; icon: string } | null }>
  worker_jobs: JobItem[]
  received_ratings: RatingItem[]
}

function getWorkerSuspensionReason(w: Worker): string {
  const photo = w.profiles?.photo_url
  if (photo && photo.startsWith('suspension_reason:')) {
    return photo.replace('suspension_reason:', '')
  }
  return ''
}

export function WorkersPage() {
  const { user: currentUser }       = useAuth()
  const toast                       = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [workers, setWorkers]       = useState<Worker[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updating, setUpdating]     = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalWorkers, setTotalWorkers] = useState(0)

  // Edit Modal State
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)

  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && workers.length > 0) {
      if (!editingWorker || editingWorker.id !== viewId) {
        const workerToView = workers.find(w => w.id === viewId);
        if (workerToView) {
          // Manually trigger the edit modal prep
          setEditingWorker(workerToView)
          setEditName(workerToView.profiles?.name || '')
          setEditPhone(workerToView.phone || '')
          setEditEmail(workerToView.email || '')
          setEditExp(workerToView.worker_profiles?.experience_years || 0)
          setEditStatus(workerToView.worker_profiles?.verification_status || 'pending')
          setEditAccountStatus(workerToView.status || 'active')
          setEditRole((workerToView as any).role || 'worker')
          setEditSuspensionReason(getWorkerSuspensionReason(workerToView))
          setEditPhoneType(workerToView.worker_profiles?.phone_type || 'smartphone')
          
          const profileArea = workerToView.profiles?.area || ''
          const dist = JAMMU_DISTRICT_OPTIONS.find(d => getAreasForDistrict(d).includes(profileArea)) || 'Jammu'
          setEditDistrict(dist)
          setEditArea(profileArea)
          setEditPincode(JAMMU_AREAS[profileArea]?.pincode || '')

          const assignedSkillIds = (workerToView.worker_skills || []).map(ws => ws.skill_id || ws.skills?.id).filter(Boolean) as string[]
          setEditSkills(assignedSkillIds)
        }
      }
    } else if (!viewId && editingWorker) {
      setEditingWorker(null);
    }
  }, [searchParams.get('view'), workers.length]);

  const [editName, setEditName]           = useState('')
  const [editPhone, setEditPhone]         = useState('')
  const [editEmail, setEditEmail]         = useState('')
  const [editDistrict, setEditDistrict]   = useState('Jammu')
  const [editArea, setEditArea]           = useState('')
  const [editPincode, setEditPincode]     = useState('')
  const [editExp, setEditExp]             = useState<number>(0)
  const [editStatus, setEditStatus]       = useState<VerificationStatus>('pending')
  const [editAccountStatus, setEditAccountStatus] = useState<string>('active')
  const [editRole, setEditRole]           = useState<string>('worker')
  const [editSuspensionReason, setEditSuspensionReason] = useState<string>('')
  const [editPhoneType, setEditPhoneType] = useState<PhoneType>('smartphone')
  const [editSkills, setEditSkills]       = useState<string[]>([])
  const [availableSkills, setAvailableSkills] = useState<{id: string; name: string; icon: string}[]>([])
  const [savingEdit, setSavingEdit]       = useState(false)
  const [editError, setEditError]         = useState('')

  // View Work History Modal State
  const [viewHistoryWorker, setViewHistoryWorker] = useState<Worker | null>(null)

  type WorkerPriceUnit = 'day' | 'meter' | 'foot' | 'sqft'
  type WorkerPriceOverride = { amount: number; unit: WorkerPriceUnit }

  // Price Edit Modal State
  const [editingPriceWorker, setEditingPriceWorker] = useState<Worker | null>(null)
  const [editPriceValue, setEditPriceValue] = useState<number>(0)
  const [editPriceUnit, setEditPriceUnit] = useState<WorkerPriceUnit>('day')
  const [priceOverrides, setPriceOverrides] = useState<Record<string, WorkerPriceOverride>>({})

  // Delete Modal State
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null)
  const [deleting, setDeleting]             = useState(false)

  async function fetchWorkers(nextPage = currentPage, nextPageSize = pageSize, nextFilter = filter, search = searchQuery) {
    setLoading(true)
    let query = supabase
      .from('users')
      .select(`
        id, phone, email, status, created_at, role,
        profiles (name, area, photo_url),
        worker_profiles (verification_status, is_available, experience_years, phone_type, enrollment_method),
        worker_skills (skill_id, skills (id, name, icon)),
        worker_jobs:jobs!jobs_worker_id_fkey (
          id, status, area, address, price, created_at,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name))
        ),
        received_ratings:ratings!ratings_to_user_id_fkey (score, comment, created_at)
      `, { count: 'exact' })
      .eq('role', 'worker')
      .order('created_at', { ascending: false })
      .range((nextPage - 1) * nextPageSize, nextPage * nextPageSize - 1)

    if (nextFilter === 'pending') query = query.eq('worker_profiles.verification_status', 'pending')
    if (nextFilter === 'verified') query = query.eq('worker_profiles.verification_status', 'verified')
    if (nextFilter === 'rejected') query = query.eq('worker_profiles.verification_status', 'rejected')
    if (nextFilter === 'disabled') query = query.or('status.eq.suspended,status.eq.disabled')

    if (search) {
      const q = search.trim()
      const { data: profileMatches } = await supabase.from('profiles').select('user_id').ilike('name', `%${q}%`)
      const profileIds = (profileMatches || []).map(p => p.user_id)
      const idFilter = profileIds.length > 0 ? `id.in.(${profileIds.map(id => `"${id}"`).join(',')}),` : ''
      query = query.or(`${idFilter}phone.ilike.%${q}%,email.ilike.%${q}%`)
    }

    const res = await query
    if (res.error) {
      console.error('Fetch workers error:', res.error)
      toast.error('Failed to load workers: ' + res.error.message)
      setWorkers([])
      setTotalWorkers(0)
      setLoading(false)
      return
    }

    setWorkers((res.data ?? []) as unknown as Worker[])
    setTotalWorkers(res.count ?? (res.data ?? []).length)
    setLoading(false)
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mistriji_worker_price_overrides')
      if (saved) setPriceOverrides(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    fetchWorkers(1, pageSize, filter)
  }, [filter])

  useEffect(() => {
    supabase.from('skills').select('id, name, icon').eq('is_active', true).then(({data}) => {
      if (data) setAvailableSkills(data)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchWorkers(1, pageSize, filter, searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchWorkers(currentPage, pageSize, filter)
  }, [currentPage, pageSize])

  useEffect(() => {
    localStorage.setItem('mistriji_worker_price_overrides', JSON.stringify(priceOverrides))
  }, [priceOverrides])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (editingPriceWorker || deletingWorker) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [editingPriceWorker, deletingWorker])

  async function updateVerification(workerId: string, status: VerificationStatus) {
    setUpdating(workerId)
    const { error } = await supabase
      .from('worker_profiles')
      .update({ verification_status: status })
      .eq('user_id', workerId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Worker profile status updated to ${status}`)
      const matched = workers.find(w => w.id === workerId)
      logAdminAction({
        actor: currentUser,
        action: `Worker KYC ${status.toUpperCase()}`,
        targetType: 'worker',
        targetId: workerId,
        details: `updated KYC verification status to "${status}" for worker ${matched?.profiles?.name || ''} (+91 ${matched?.phone || ''})`,
      })
      await fetchWorkers()
    }
    setUpdating(null)
  }

  async function toggleDisableWorker(worker: Worker) {
    setUpdating(worker.id)
    const isCurrentlyDisabled = worker.status === 'suspended' || worker.status === 'disabled'
    const newStatus = isCurrentlyDisabled ? 'active' : 'suspended'
    const isAvailable = isCurrentlyDisabled ? true : false
    const reasonValue = isCurrentlyDisabled ? null : (getWorkerSuspensionReason(worker) || 'Suspended by Administrator')
    const storedPhotoUrl = newStatus === 'suspended' ? `suspension_reason:${reasonValue}` : null

    try {
      const { error: uErr } = await supabase.from('users').update({ status: newStatus }).eq('id', worker.id)
      if (uErr) throw uErr
      await supabase.from('profiles').update({ photo_url: storedPhotoUrl }).eq('user_id', worker.id)
      await supabase.from('worker_profiles').update({ is_available: isAvailable }).eq('user_id', worker.id)
      toast.success(isCurrentlyDisabled ? 'Worker account enabled!' : 'Worker account suspended & logged out!')
      
      logAdminAction({
        actor: currentUser,
        action: isCurrentlyDisabled ? 'Worker Enabled' : 'Worker Disabled',
        targetType: 'worker',
        targetId: worker.id,
        details: `${isCurrentlyDisabled ? 'enabled' : 'disabled / suspended'} worker ${worker.profiles?.name || 'Worker'} (+91 ${worker.phone})`,
      })

      await fetchWorkers()
    } catch (err: any) {
      toast.error('Failed to update worker status: ' + err.message)
    } finally {
      setUpdating(null)
    }
  }

  function openEditModal(worker: Worker) {
    const areaName = worker.profiles?.area ?? 'Gandhi Nagar'
    const districtName = JAMMU_AREAS[areaName]?.district || 'Jammu'
    const pincode = JAMMU_AREAS[areaName]?.pincode || ''

    setEditingWorker(worker)
    setEditName(worker.profiles?.name ?? '')
    setEditPhone(worker.phone ?? '')
    setEditEmail(worker.email ?? '')
    setEditDistrict(districtName)
    setEditArea(areaName)
    setEditPincode(pincode)
    setEditExp(worker.worker_profiles?.experience_years ?? 0)
    setEditStatus(worker.worker_profiles?.verification_status ?? 'pending')
    setEditAccountStatus(worker.status ?? 'active')
    setEditSuspensionReason(getWorkerSuspensionReason(worker) || 'Suspended by Administrator')
    setEditPhoneType(worker.worker_profiles?.phone_type ?? 'smartphone')
    
    // Extract assigned skill IDs
    const currentSkillIds = worker.worker_skills
      ?.map(ws => ws.skill_id || ws.skills?.id)
      .filter(Boolean) as string[]
    setEditSkills(currentSkillIds || [])
    
    setEditError('')
    
    // Load Price Overrides
    const override = priceOverrides[worker.id] ?? { amount: 0, unit: 'day' }
    setEditPriceValue(override.amount)
    setEditPriceUnit(override.unit)
  }

  useEffect(() => {
    if (!editingWorker) return
    const areaOptions = getAreasForDistrict(editDistrict)
    if (areaOptions.length > 0 && !areaOptions.includes(editArea)) {
      const nextArea = areaOptions[0]
      setEditArea(nextArea)
      setEditPincode(JAMMU_AREAS[nextArea]?.pincode || '')
    }
  }, [editDistrict, editingWorker, editArea])

  function openEditPriceModal(worker: Worker) {
    const override = priceOverrides[worker.id] ?? { amount: 0, unit: 'day' }
    setEditingPriceWorker(worker)
    setEditPriceValue(override.amount)
    setEditPriceUnit(override.unit)
  }

  function saveWorkerPrice() {
    if (!editingPriceWorker) return
    const safePrice = Math.max(0, Number(editPriceValue) || 0)
    const priceOverride = { amount: safePrice, unit: editPriceUnit }
    setPriceOverrides(prev => ({ ...prev, [editingPriceWorker.id]: priceOverride }))
    const labelMap: Record<WorkerPriceUnit, string> = { day: 'day', meter: 'meter', foot: 'foot', sqft: 'sq ft' }
    toast.success(`Updated worker rate to ₹${safePrice} / ${labelMap[editPriceUnit]}`)
    setEditingPriceWorker(null)
    setEditPriceValue(0)
    setEditPriceUnit('day')
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingWorker) return
    setSavingEdit(true)
    setEditError('')

    try {
      const cleanPhone = editPhone.replace(/^\+91/, '').trim()
      const isAvailable = editAccountStatus === 'active'
      const storedPhotoUrl = editAccountStatus === 'suspended'
        ? `suspension_reason:${editSuspensionReason.trim() || 'Suspended by Administrator'}`
        : null

      const { error: uErr } = await supabase.from('users').update({ phone: cleanPhone, email: editEmail.trim() || null, status: editAccountStatus, role: editRole }).eq('id', editingWorker.id)
      if (uErr) throw uErr

      await supabase.from('profiles').upsert({
        user_id: editingWorker.id,
        name: editName,
        district: editDistrict,
        area: editArea,
        city: editDistrict,
        pincode: editPincode,
        photo_url: storedPhotoUrl
      })
      await supabase.from('worker_profiles').upsert({
        user_id: editingWorker.id,
        verification_status: editStatus,
        experience_years: editExp,
        phone_type: editPhoneType,
        is_available: isAvailable,
      })

      // Save Price Overrides
      const safePrice = Math.max(0, Number(editPriceValue) || 0)
      const priceOverride = { amount: safePrice, unit: editPriceUnit }
      setPriceOverrides(prev => ({ ...prev, [editingWorker.id]: priceOverride }))

      // Update Skills
      await supabase.from('worker_skills').delete().eq('worker_id', editingWorker.id)
      if (editSkills.length > 0) {
        await supabase.from('worker_skills').insert(
          editSkills.map(skill_id => ({ worker_id: editingWorker.id, skill_id }))
        )
      }

      toast.success(editAccountStatus === 'suspended' ? 'Worker profile updated and account suspended!' : 'Worker profile updated!')

      logAdminAction({
        actor: currentUser,
        action: 'Worker Profile Updated',
        targetType: 'worker',
        targetId: editingWorker.id,
        details: `updated profile, skills and credentials for worker ${editName} (+91 ${cleanPhone})`,
      })

      setEditingWorker(null)
      await fetchWorkers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update worker.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteWorker() {
    if (!deletingWorker) return
    setDeleting(true)
    try {
      // Manual cascade delete to avoid DB constraints
      
      // 1. Unassign worker from any jobs
      await supabase.from('jobs').update({ worker_id: null, status: 'requested' }).eq('worker_id', deletingWorker.id)
      
      // 2. Delete worker relations
      await supabase.from('worker_skills').delete().eq('worker_id', deletingWorker.id)
      await supabase.from('employer_workers').delete().eq('worker_id', deletingWorker.id)
      
      // 3. Delete ratings and support messages
      await supabase.from('ratings').delete().eq('to_user_id', deletingWorker.id)
      await supabase.from('ratings').delete().eq('from_user_id', deletingWorker.id)
      await supabase.from('support_messages').delete().eq('user_id', deletingWorker.id)
      
      // 4. Delete profiles
      await supabase.from('worker_profiles').delete().eq('user_id', deletingWorker.id)
      await supabase.from('profiles').delete().eq('user_id', deletingWorker.id)

      const { error } = await supabase.from('users').delete().eq('id', deletingWorker.id)
      if (error) throw error
      toast.success('Worker deleted successfully')

      logAdminAction({
        actor: currentUser,
        action: 'Worker Deleted',
        targetType: 'worker',
        targetId: deletingWorker.id,
        details: `permanently deleted worker ${deletingWorker.profiles?.name || 'Worker'} (+91 ${deletingWorker.phone})`,
      })

      setDeletingWorker(null)
      await fetchWorkers()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filteredWorkers = workers.filter(w => {
    if (filter === 'all') return true
    if (filter === 'disabled') return w.status === 'suspended' || w.status === 'disabled'
    return w.worker_profiles?.verification_status === filter && w.status !== 'suspended' && w.status !== 'disabled'
  })

  // Streamlined 4-Column Table Configuration for Clean, Compact UI
  const columns: Column<Worker>[] = [
    {
      key: 'name',
      header: 'Worker Profile',
      searchValue: w => `${w.profiles?.name ?? ''} ${w.phone}`,
      render: w => {
        const isDisabled = w.status === 'suspended' || w.status === 'disabled'
        const ratings = w.received_ratings ?? []
        const count = ratings.length
        const avg = count > 0 ? (ratings.reduce((acc, r) => acc + r.score, 0) / count).toFixed(1) : null
        const photo = w.profiles?.photo_url && !w.profiles.photo_url.startsWith('suspension_reason:') ? w.profiles.photo_url : null

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: isDisabled ? 0.6 : 1 }}>
            <div className="avatar avatar-md">
              {photo ? (
                <img src={photo} alt={w.profiles?.name ?? 'Worker'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                w.profiles?.name?.[0] ?? '?'
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {w.profiles?.name ?? 'Unknown Profile'}
                {avg ? (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>⭐ {avg}</span>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>⭐ New</span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>+91 {w.phone}</div>
              {w.email && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{w.email}</div>}
            </div>
          </div>
        )
      }
    },
    {
      key: 'skills_area',
      header: 'Skill & Area',
      searchValue: w => `${w.profiles?.area ?? ''} ${w.worker_skills?.map(ws => ws.skills?.name).join(' ')}`,
      render: w => (
        <div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
            {w.worker_skills?.slice(0, 2).map((ws, i) => (
              <span key={i} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                {ws.skills?.icon} {ws.skills?.name}
              </span>
            ))}
            {(w.worker_skills?.length ?? 0) === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>No skills</span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>📍 {w.profiles?.area ?? 'Jammu'}</div>
        </div>
      )
    },
    {
      key: 'status_jobs',
      header: 'Status & History',
      searchValue: w => w.status === 'suspended' ? 'disabled' : (w.worker_profiles?.verification_status ?? 'pending'),
      render: w => {
        const completed = w.worker_jobs?.filter(j => j.status === 'completed').length ?? 0
        const isDisabled = w.status === 'suspended' || w.status === 'disabled'
        const st = w.worker_profiles?.verification_status ?? 'pending'
        const reason = getWorkerSuspensionReason(w)

        return (
          <div>
            <div style={{ marginBottom: '0.2rem' }}>
              {isDisabled ? (
                <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>🚫 Suspended</span>
              ) : st === 'verified' ? (
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ Verified</span>
              ) : st === 'rejected' ? (
                <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>✗ Rejected</span>
              ) : (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>⏳ Pending</span>
              )}
            </div>
            {isDisabled && (
              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginBottom: '0.25rem', maxWidth: 180, wordBreak: 'break-word', fontWeight: 500 }}>
                Reason: {reason || 'Suspended by Administrator'}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 500 }}>
              🔨 {completed} completed jobs
            </div>
          </div>
        )
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: w => {
        return (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button 
              className="btn btn-xs btn-primary" 
              onClick={() => { setSearchParams({ view: w.id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              View Details
            </button>
          </div>
        )
      }
    }
  ]

  
  if (editingWorker) {
    return (
      <div className="admin-content" style={{ paddingBottom: '3rem', animation: 'fadeIn 0.2s ease' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => { setEditingWorker(null); setSearchParams({}); }} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button 
                onClick={() => { setEditingWorker(null); setSearchParams({}); }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                className="hover-text"
              >
                Workers
              </button>
              <ChevronRight size={14} color="#94a3b8" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>Profile</span>
            </div>
            <h1 className="page-title">{editName || 'Worker Profile'}</h1>
            <p className="page-subtitle">Manage details, history, and status for {editName}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Edit Form */}
          <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Edit Details
              </h3>
            </div>
            
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {editError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  {editError}
                </div>
              )}

              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required placeholder="e.g. Ramesh Sharma" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} required placeholder="98xxxxxxxx" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="worker@email.com" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">District *</label>
                  <select
                    className="input"
                    value={editDistrict}
                    onChange={e => {
                      const nextDistrict = e.target.value
                      setEditDistrict(nextDistrict)
                      const nextAreas = getAreasForDistrict(nextDistrict)
                      const nextArea = nextAreas[0] || editArea
                      setEditArea(nextArea)
                      setEditPincode(JAMMU_AREAS[nextArea]?.pincode || '')
                    }}
                  >
                    {JAMMU_DISTRICT_OPTIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Area *</label>
                  <select
                    className="input"
                    value={editArea}
                    onChange={e => {
                      const nextArea = e.target.value
                      setEditArea(nextArea)
                      setEditPincode(JAMMU_AREAS[nextArea]?.pincode || '')
                    }}
                  >
                    {getAreasForDistrict(editDistrict).map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" value={editPincode} onChange={e => setEditPincode(e.target.value)} placeholder="180004" />
                </div>
                <div>
                  <label className="label">Experience (Years)</label>
                  <input type="number" min={0} max={50} className="input" value={editExp} onChange={e => setEditExp(Number(e.target.value))} />
                </div>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🔧 Assigned Services / Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {availableSkills.map(s => {
                    const isSelected = editSkills.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setEditSkills(prev => 
                            isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '2rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          border: `1px solid ${isSelected ? '#4f46e5' : '#cbd5e1'}`,
                          background: isSelected ? '#eef2ff' : '#ffffff',
                          color: isSelected ? '#4f46e5' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{s.icon}</span> {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  💰 Custom Pricing / Dihaadi Rate
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Rate / Amount</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>₹</span>
                      <input type="number" min="0" className="input" value={editPriceValue} onChange={e => setEditPriceValue(Number(e.target.value))} style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Pricing Unit</label>
                    <select className="input" value={editPriceUnit} onChange={e => setEditPriceUnit(e.target.value as any)}>
                      <option value="day">Per Day (Dihaadi)</option>
                      <option value="sqft">Per Sq. Ft.</option>
                      <option value="meter">Per Meter</option>
                      <option value="foot">Per Foot</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Verification Status</label>
                  <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value as any)}>
                    <option value="pending">⏳ Pending Verification</option>
                    <option value="verified">✓ Verified & Approved</option>
                    <option value="rejected">✗ Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone Type</label>
                  <select className="input" value={editPhoneType} onChange={e => setEditPhoneType(e.target.value as any)}>
                    <option value="smartphone">📱 Smartphone</option>
                    <option value="keypad">🔢 Keypad Phone</option>
                    <option value="none">❌ No Phone</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label">Account Role</label>
                  <select className="input" value={editRole} onChange={e => setEditRole(e.target.value)}>
                    <option value="worker">Worker</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Actions & History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Account Status Card */}
            <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Account Actions
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: editAccountStatus === 'active' ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', border: `1px solid ${editAccountStatus === 'active' ? '#bbf7d0' : '#fecaca'}` }}>
                  <div>
                    <div style={{ fontWeight: 700, color: editAccountStatus === 'active' ? '#15803d' : '#dc2626' }}>
                      {editAccountStatus === 'active' ? 'Account Active' : 'Account Suspended'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>
                      {editAccountStatus === 'active' ? 'Worker is visible to customers' : 'Worker cannot login or receive jobs'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newStatus = editAccountStatus === 'active' ? 'suspended' : 'active'
                      setEditAccountStatus(newStatus)
                      // Also auto-save it immediately for convenience
                      supabase.from('users').update({ status: newStatus }).eq('id', editingWorker.id).then(() => {
                        toast.success(newStatus === 'active' ? 'Worker enabled' : 'Worker suspended')
                        fetchWorkers()
                      })
                    }}
                    className={`btn btn-sm ${editAccountStatus === 'active' ? 'btn-danger' : 'btn-success'}`}
                  >
                    {editAccountStatus === 'active' ? <><Ban size={14} /> Suspend Worker</> : <><CheckCircle size={14} /> Enable Worker</>}
                  </button>
                </div>
                
                {editAccountStatus === 'suspended' && (
                  <div>
                    <label className="label">Suspension Reason (Visible to Worker)</label>
                    <input className="input" value={editSuspensionReason} onChange={e => setEditSuspensionReason(e.target.value)} placeholder="e.g. Multiple customer complaints" />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#334155' }}>Delete Account</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>Permanently remove this worker</div>
                  </div>
                  <button onClick={() => setDeletingWorker(editingWorker)} className="btn btn-sm btn-danger">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>

            {/* History Card */}
            <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Work History & Reviews
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Total Jobs</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                    {editingWorker.worker_jobs?.length ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Completed</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                    {editingWorker.worker_jobs?.filter(j => j.status === 'completed').length ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Reviews</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                    {editingWorker.received_ratings?.length ?? 0}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0.5rem 0 0.5rem 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>
                Past Jobs History
              </h4>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {(editingWorker.worker_jobs?.length ?? 0) === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                    No job history recorded yet.
                  </div>
                ) : (
                  editingWorker.worker_jobs.map(j => (
                    <div key={j.id} style={{
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fff',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.825rem', color: '#0f172a' }}>
                          {j.skills?.icon} {j.skills?.name || 'Service Work'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                          📍 {j.area} • Customer: {j.customer?.profiles?.name || j.customer?.phone || 'Guest'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.825rem' }}>₹{j.price ?? 0}</div>
                        <span className={`badge ${j.status === 'completed' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          {j.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <h4 style={{ margin: '0.75rem 0 0.5rem 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>
                Customer Feedback
              </h4>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(editingWorker.received_ratings?.length ?? 0) === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                    No customer ratings yet.
                  </div>
                ) : (
                  editingWorker.received_ratings.map((r, idx) => (
                    <div key={idx} style={{ padding: '0.55rem 0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: '#b45309' }}>{'⭐'.repeat(r.score)} ({r.score} / 5)</div>
                      <div style={{ color: '#78350f', marginTop: '0.15rem' }}>"{r.comment || 'Great service!'}"</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // DataTable view
  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workers Management</h1>
          <p className="page-subtitle">Track ratings, work history, verification, and enable/disable worker accounts</p>
        </div>
        <Link to="/workers/enroll" className="btn btn-primary">
          <PlusCircle size={16} /> Enroll Worker
        </Link>
      </div>

      <DataTable
        data={workers}
        columns={columns}
        loading={loading}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search workers by name, phone, or email..."
        defaultPageSize={10}
        emptyMessage="No workers found"
        emptyIcon="👷"
        toolbarActions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--gray-100)', padding: '0.25rem', borderRadius: '0.5rem' }}>
              {(['all', 'pending', 'verified', 'rejected', 'disabled'] as const).map(f => (
                <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => fetchWorkers(currentPage, pageSize, filter)} title="Refresh list">
              <RefreshCw size={14} />
            </button>
          </div>
        }
        serverPagination={{
          totalCount: totalWorkers,
          currentPage,
          pageSize,
          onPageChange: (page) => setCurrentPage(page),
          onPageSizeChange: (size) => {
            setPageSize(size)
            setCurrentPage(1)
          },
        }}
      />

      {/* Delete Modal State */}
      {deletingWorker && (
        <div style={modalStyles.overlay} onClick={() => setDeletingWorker(null)}>
          <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Delete Worker</h3>
              <button onClick={() => setDeletingWorker(null)} style={modalStyles.closeBtn}><X size={18} /></button>
            </div>
            <div style={modalStyles.body}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Are you sure you want to delete worker <strong>{deletingWorker.profiles?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div style={modalStyles.footer}>
              <button className="btn btn-secondary" onClick={() => setDeletingWorker(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteWorker} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Worker'}
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
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    padding: '1rem',
  },
  card: {
    background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 700,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  body: {
    padding: '1.5rem', overflowY: 'auto' as const, flex: 1,
  },
  footer: {
    padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
    display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0,
  },
  closeBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer', width: 28, height: 28,
    borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#64748b', transition: 'all 0.15s ease',
  },
}
