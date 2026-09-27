import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sendAdminWelcomeEmailApi } from '@/lib/authApi'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { DataTable, Column } from '@/components/ui/DataTable'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Edit3,
  Trash2,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Mail,
  Phone,
  Lock,
  Copy,
  Check,
  UserCheck,
  History,
  Users,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Briefcase,
  Wrench,
  Layers,
  MapPin,
  Clock
} from 'lucide-react'

interface AdminUser {
  id: string
  phone: string | null
  email: string | null
  role: 'admin' | 'super_admin'
  status: string
  pin_hash: string | null
  created_at: string
  profiles: { name: string; area: string } | null
}

interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  target_id: string | null
  target_type: string | null
  old_value: any
  new_value: any
  created_at: string
  actor?: {
    email: string | null
    phone: string | null
    role: string | null
    profiles: { name: string } | null
  } | null
}

export function AdminsPage() {
  const { user: currentAuthUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabParam = searchParams.get('tab') === 'history' ? 'history' : 'admins'
  const [activeTab, setActiveTab] = useState<'admins' | 'history'>(activeTabParam)

  // Admins state
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showPins, setShowPins] = useState<Record<string, boolean>>({})
  const [copiedPin, setCopiedPin] = useState<string | null>(null)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('123456')
  const [status, setStatus] = useState<'active' | 'suspended'>('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete State
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null)

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditFilter, setAuditFilter] = useState<'all' | 'customer' | 'worker' | 'service' | 'job' | 'location_catalog'>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') === 'history' ? 'history' : 'admins'
    setActiveTab(tabFromUrl)
  }, [searchParams])

  const handleTabChange = (newTab: 'admins' | 'history') => {
    setActiveTab(newTab)
    if (newTab === 'history') {
      setSearchParams({ tab: 'history' })
      void fetchAuditLogs()
    } else {
      setSearchParams({})
      void fetchAdmins()
    }
  }

  async function fetchAdmins() {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, phone, email, role, status, pin_hash, created_at,
        profiles (name, area)
      `)
      .eq('role', 'admin') // Never include super_admin in this editable list
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch admins error:', error)
      toast.error(error.message || 'Failed to fetch admin accounts.')
    }

    setAdmins((data ?? []) as unknown as AdminUser[])
    setLoading(false)
  }

  async function fetchAuditLogs() {
    setAuditLoading(true)
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id, actor_id, action, target_id, target_type, old_value, new_value, created_at,
          actor:users!audit_logs_actor_id_fkey (
            email, phone, role, profiles (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        // Fallback query if FK name differs
        const { data: fallbackData, error: fbErr } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)

        if (fbErr) throw fbErr
        setAuditLogs((fallbackData ?? []) as AuditLogEntry[])
      } else {
        setAuditLogs((data ?? []) as unknown as AuditLogEntry[])
      }
    } catch (err: any) {
      console.error('Fetch audit logs error:', err)
      toast.error('Could not load audit log history: ' + (err.message || 'Error'))
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    if (currentAuthUser) {
      if (activeTab === 'admins') {
        void fetchAdmins()
      } else {
        void fetchAuditLogs()
      }
    }
  }, [currentAuthUser?.id, activeTab])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal || deletingAdmin) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [showModal, deletingAdmin])

  function togglePinVisibility(id: string) {
    setShowPins(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleCopyPin(pinCode: string, id: string) {
    navigator.clipboard.writeText(pinCode)
    setCopiedPin(id)
    toast.success('PIN copied to clipboard!')
    setTimeout(() => setCopiedPin(null), 2000)
  }

  function openCreateModal() {
    setEditingAdmin(null)
    setName('')
    setPhone('')
    setEmail('')
    setPin('123456')
    setStatus('active')
    setError('')
    setShowModal(true)
  }

  function openEditModal(a: AdminUser) {
    if (a.role === 'super_admin') {
      toast.error('Super Admin account is permanently locked and cannot be modified.')
      return
    }
    setEditingAdmin(a)
    setName(a.profiles?.name || '')
    setPhone(a.phone && !a.phone.startsWith('000') ? a.phone : '')
    setEmail(a.email && !a.email.startsWith('admin_') ? a.email : '')
    setPin(a.pin_hash || '123456')
    setStatus((a.status === 'active' || a.status === 'suspended') ? a.status : 'active')
    setError('')
    setShowModal(true)
  }

  function openDeleteModal(a: AdminUser) {
    if (a.role === 'super_admin') {
      toast.error('Super Admin account is permanently locked and cannot be deleted.')
      return
    }
    setDeletingAdmin(a)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanName = name.trim()
    const cleanPhone = phone.trim().replace(/\D/g, '')
    const cleanEmail = email.trim().toLowerCase()
    const cleanPin = pin.trim()

    if (!cleanName) {
      setError('Admin name is required.')
      return
    }
    if (!cleanPhone && !cleanEmail) {
      setError('Either a Phone number or Email address is required for admin login.')
      return
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      setError('Please provide a valid 10-digit Indian mobile number.')
      return
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid email address.')
      return
    }
    if (!cleanPin || cleanPin.length < 4) {
      setError('PIN must be at least 4 digits for security.')
      return
    }

    setSaving(true)
    try {
      if (editingAdmin) {
        const { error: userErr } = await supabase
          .from('users')
          .update({
            phone: cleanPhone || null,
            email: cleanEmail || null,
            status,
            pin_hash: cleanPin,
          })
          .eq('id', editingAdmin.id)
        if (userErr) throw userErr

        const { error: profErr } = await supabase
          .from('profiles')
          .update({ name: cleanName })
          .eq('user_id', editingAdmin.id)
        if (profErr) throw profErr

        toast.success(`Admin "${cleanName}" updated successfully!`)
      } else {
        const tempPhone = cleanPhone || `0000000000`
        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert({
            phone: tempPhone,
            email: cleanEmail || null,
            role: 'customer',
            status,
            pin_hash: cleanPin,
          })
          .select('id')
          .single()
        if (userErr) throw userErr

        const { error: roleErr } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', newUser.id)
        if (roleErr) throw roleErr

        await supabase.from('profiles').insert({
          user_id: newUser.id,
          name: cleanName,
          area: 'Jammu',
          city: 'Jammu',
        })
        toast.success(`Admin "${cleanName}" created successfully!`)

        if (cleanEmail) {
          try {
            const welcomeRes = await sendAdminWelcomeEmailApi({
              email: cleanEmail,
              name: cleanName,
              pin: cleanPin,
              phone: cleanPhone || undefined,
              role: 'Administrator',
            })
            if (welcomeRes.success) {
              toast.info(`Onboarding email with login PIN sent to ${cleanEmail}`)
            }
          } catch (mailErr) {
            console.warn('Welcome email warning:', mailErr)
          }
        }
      }

      setShowModal(false)
      await fetchAdmins()
    } catch (err: any) {
      const msg = err.message || 'Operation failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingAdmin) return
    if (deletingAdmin.role === 'super_admin') {
      toast.error('Super Admin accounts cannot be deleted.')
      return
    }
    try {
      const { error } = await supabase.from('users').delete().eq('id', deletingAdmin.id)
      if (error) throw error
      toast.success('Admin account deleted successfully.')
      setDeletingAdmin(null)
      await fetchAdmins()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Admin',
      searchValue: a => `${a.profiles?.name ?? ''} ${a.phone ?? ''} ${a.email ?? ''}`,
      render: a => {
        const adminName = a.profiles?.name || 'Administrator'
        const initials = adminName
          .split(' ')
          .map(n => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                {adminName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                <Shield size={12} style={{ color: '#4f46e5' }} />
                <span>Operational Admin</span>
              </div>
            </div>
          </div>
        )
      }
    },
    {
      key: 'contact',
      header: 'Login Identifier',
      searchValue: a => `${a.phone ?? ''} ${a.email ?? ''}`,
      render: a => {
        const hasRealPhone = a.phone && !a.phone.startsWith('000')
        const hasRealEmail = a.email && !a.email.startsWith('admin_')

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {hasRealPhone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#334155' }}>
                <Phone size={13} style={{ color: '#64748b' }} />
                <span>+91 {a.phone}</span>
              </div>
            ) : null}
            {hasRealEmail ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#334155' }}>
                <Mail size={13} style={{ color: '#64748b' }} />
                <span>{a.email}</span>
              </div>
            ) : null}
            {!hasRealPhone && !hasRealEmail && (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>None</span>
            )}
          </div>
        )
      }
    },
    {
      key: 'pin',
      header: 'Admin PIN',
      render: a => {
        const isVisible = !!showPins[a.id]
        const pinCode = a.pin_hash || '123456'
        const isCopied = copiedPin === a.id

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              fontWeight: 700,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              letterSpacing: isVisible ? '0.1em' : '0.2em',
              color: '#1e293b',
              minWidth: '70px',
              textAlign: 'center',
            }}>
              {isVisible ? pinCode : '••••••'}
            </div>
            <button
              type="button"
              onClick={() => togglePinVisibility(a.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#64748b',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                borderRadius: '0.25rem',
              }}
              title={isVisible ? 'Hide PIN' : 'Reveal PIN'}
            >
              {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              onClick={() => handleCopyPin(pinCode, a.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: isCopied ? '#16a34a' : '#64748b',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                borderRadius: '0.25rem',
              }}
              title="Copy PIN"
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: a => {
        const isActive = String(a.status).toLowerCase() !== 'disabled' && String(a.status).toLowerCase() !== 'suspended'
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isActive ? '#ecfdf5' : '#f1f5f9',
              color: isActive ? '#065f46' : '#475569',
              border: `1px solid ${isActive ? '#a7f3d0' : '#e2e8f0'}`,
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isActive ? '#10b981' : '#94a3b8',
              display: 'inline-block',
            }} />
            {isActive ? 'Active' : 'Disabled'}
          </span>
        )
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: a => (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => openEditModal(a)}
            title="Edit Admin"
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => openDeleteModal(a)}
            title="Delete Admin"
            style={{
              padding: '0.35rem 0.5rem',
              fontSize: '0.75rem',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )
    }
  ]

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditFilter !== 'all') {
      const typeLower = (log.target_type || '').toLowerCase()
      const actionLower = (log.action || '').toLowerCase()
      if (auditFilter === 'customer' && !typeLower.includes('customer') && !actionLower.includes('customer')) return false
      if (auditFilter === 'worker' && !typeLower.includes('worker') && !actionLower.includes('worker')) return false
      if (auditFilter === 'service' && !typeLower.includes('service') && !actionLower.includes('service')) return false
      if (auditFilter === 'job' && !typeLower.includes('job') && !actionLower.includes('job') && !actionLower.includes('booking')) return false
      if (auditFilter === 'location_catalog' && !typeLower.includes('location') && !typeLower.includes('district') && !actionLower.includes('area') && !actionLower.includes('district')) return false
    }

    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase()
      const actorName = log.actor?.profiles?.name || ''
      const actorEmail = log.actor?.email || ''
      const actorPhone = log.actor?.phone || ''
      const action = log.action || ''
      return actorName.toLowerCase().includes(q) ||
        actorEmail.toLowerCase().includes(q) ||
        actorPhone.toLowerCase().includes(q) ||
        action.toLowerCase().includes(q)
    }
    return true
  })

  const getTargetInspectionLink = (log: AuditLogEntry) => {
    const actionLower = (log.action + ' ' + (log.target_type || '')).toLowerCase()
    if (actionLower.includes('customer')) return { label: 'Inspect in Customers Desk', path: '/customers' }
    if (actionLower.includes('worker')) return { label: 'Inspect in Workers Desk', path: '/workers' }
    if (actionLower.includes('service')) return { label: 'Inspect Services Catalog', path: '/services' }
    if (actionLower.includes('job') || actionLower.includes('booking')) return { label: 'Inspect Bookings Desk', path: '/jobs' }
    if (actionLower.includes('district') || actionLower.includes('area') || actionLower.includes('location')) return { label: 'Inspect Service Areas', path: '/areas' }
    return null
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            Admin Control & Audit History
          </h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Manage operational admin team members and review the live history of every change made by admins
          </p>
        </div>

        {/* Action button */}
        {activeTab === 'admins' ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={fetchAdmins} title="Refresh Table">
              <RefreshCw size={15} />
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Add Admin User
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={fetchAuditLogs} title="Refresh Audit Logs">
              <RefreshCw size={15} /> Refresh History
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.5rem',
        background: '#ffffff',
        padding: '0.5rem 0.5rem 0 0.5rem',
        borderRadius: '0.75rem 0.75rem 0 0'
      }}>
        <button
          onClick={() => handleTabChange('admins')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'admins' ? '3px solid #4f46e5' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'admins' ? '#4f46e5' : '#64748b',
            fontWeight: activeTab === 'admins' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={18} /> Admin Team & Roles ({admins.length})
        </button>

        <button
          onClick={() => handleTabChange('history')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid #7e22ce' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'history' ? '#7e22ce' : '#64748b',
            fontWeight: activeTab === 'history' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <History size={18} /> Admin Activity & Audit History
          {auditLogs.length > 0 && (
            <span style={{
              background: '#f3e8ff',
              color: '#7e22ce',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px'
            }}>
              {auditLogs.length} events
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ADMINS LIST */}
      {activeTab === 'admins' && (
        <div style={{ background: '#ffffff', borderRadius: '0.875rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <DataTable
            data={admins}
            columns={columns}
            loading={loading}
            searchPlaceholder="Search admins by name, email, or phone…"
            defaultPageSize={10}
            emptyMessage="No operational admin accounts found. Click '+ Add Admin User' to create one."
            emptyIcon="🛡️"
          />
        </div>
      )}

      {/* TAB 2: AUDIT LOGS & ACTION HISTORY */}
      {activeTab === 'history' && (
        <div>
          {/* Filter Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            background: '#ffffff',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Actions' },
                { id: 'customer', label: 'Customers' },
                { id: 'worker', label: 'Workers' },
                { id: 'service', label: 'Services' },
                { id: 'job', label: 'Bookings' },
                { id: 'location_catalog', label: 'Areas / Districts' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAuditFilter(f.id as any)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: auditFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                    border: auditFilter === f.id ? '1px solid #7e22ce' : '1px solid #e2e8f0',
                    background: auditFilter === f.id ? '#f3e8ff' : '#ffffff',
                    color: auditFilter === f.id ? '#6b21a8' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by admin name, email, or action..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8125rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Audit Logs List */}
          {auditLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div className="spinner" style={{ color: '#7e22ce', margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading live admin activity history…</p>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <Shield size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem' }}>
                No Admin Actions Found
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
                {auditSearch ? 'No history matching your search query.' : 'When operational admins modify customers, workers, services, or bookings, the complete record appears here in real-time.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredAuditLogs.map(log => {
                const targetLink = getTargetInspectionLink(log)
                const isExpanded = expandedLogId === log.id
                const actorName = log.actor?.profiles?.name || 'Admin User'
                const actorContact = log.actor?.phone && !log.actor.phone.startsWith('000')
                  ? `+91 ${log.actor.phone}`
                  : (log.actor?.email || 'Operational Admin')

                return (
                  <div
                    key={log.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'border 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '0.5rem',
                          background: '#f3e8ff',
                          color: '#7e22ce',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          <Shield size={20} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              color: '#0f172a'
                            }}>
                              {actorName}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '9999px'
                            }}>
                              {actorContact}
                            </span>
                          </div>

                          <div style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            marginTop: '0.35rem',
                            lineHeight: 1.4
                          }}>
                            {log.action}
                          </div>
                        </div>
                      </div>

                      {/* Timestamp & Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem' }}>
                          <Clock size={13} />
                          <span>{new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>

                        {targetLink && (
                          <button
                            onClick={() => navigate(targetLink.path)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.75rem',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.375rem',
                              color: '#334155',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <span>{targetLink.label}</span>
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expand details for before/after comparison if present */}
                    {(log.old_value !== null || log.new_value !== null) && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#7e22ce',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: 0
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Hide Payload Inspection' : 'Inspect Change Payload (Before & After)'}
                        </button>

                        {isExpanded && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '0.75rem',
                            marginTop: '0.5rem',
                            background: '#f8fafc',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem'
                          }}>
                            {log.old_value !== null && (
                              <div>
                                <span style={{ fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>
                                  Previous State:
                                </span>
                                <pre style={{ margin: 0, padding: '0.5rem', background: '#ffffff', borderRadius: '0.25rem', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                                  {typeof log.old_value === 'object' ? JSON.stringify(log.old_value, null, 2) : String(log.old_value)}
                                </pre>
                              </div>
                            )}

                            {log.new_value !== null && (
                              <div>
                                <span style={{ fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: '0.25rem' }}>
                                  New State:
                                </span>
                                <pre style={{ margin: 0, padding: '0.5rem', background: '#ffffff', borderRadius: '0.25rem', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                                  {typeof log.new_value === 'object' ? JSON.stringify(log.new_value, null, 2) : String(log.new_value)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit / Create Modal */}
      {showModal && (
        <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '0.5rem',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingAdmin ? 'Edit Admin User' : 'Add New Admin User'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Configure credentials and login access for operational staff
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={modalStyles.closeBtn} title="Close"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={modalStyles.body}>
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    {error}
                  </div>
                )}

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                    Admin Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                      Phone (OTP Login)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                        +91
                      </span>
                      <input
                        type="tel"
                        className="input"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        maxLength={10}
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                      Email (PIN / OTP Login)
                    </label>
                    <input
                      type="email"
                      className="input"
                      placeholder="admin@mistriji.in"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                      6-Digit Security PIN <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. 123456"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        required
                        style={{ fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700 }}
                      />
                      <button
                        type="button"
                        onClick={() => setPin(Math.floor(100000 + Math.random() * 900000).toString())}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.7rem',
                          color: '#4f46e5',
                          background: '#eef2ff',
                          border: 'none',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Random
                      </button>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Used for instant PIN based portal login.
                    </span>
                  </div>

                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                      Account Status
                    </label>
                    <select
                      className="input"
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="suspended">Disabled (Revoked Access)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={modalStyles.footer}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : (editingAdmin ? 'Save Changes' : 'Create Admin User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAdmin && (
        <div style={modalStyles.overlay} onClick={() => setDeletingAdmin(null)}>
          <div style={{ ...modalStyles.card, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>
                Delete Admin Account
              </h3>
              <button onClick={() => setDeletingAdmin(null)} style={modalStyles.closeBtn}><X size={18} /></button>
            </div>
            <div style={modalStyles.body}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                Are you sure you want to delete admin account <strong>{deletingAdmin.profiles?.name || deletingAdmin.phone || deletingAdmin.email}</strong>?
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                This action is irreversible and immediately terminates all active login sessions.
              </p>
            </div>
            <div style={modalStyles.footer}>
              <button className="btn btn-secondary" onClick={() => setDeletingAdmin(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleDelete}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f8fafc',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.25rem',
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    background: '#f8fafc',
  },
}
