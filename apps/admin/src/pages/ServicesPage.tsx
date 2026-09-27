import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { logAdminAction } from '@/lib/auditLogger'
import { ServiceIcon } from '@/components/ServiceIcon'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Plus, Edit3, Trash2, Check, X, RefreshCw } from 'lucide-react'

interface Skill {
  id: string
  name: string
  name_hi: string | null
  icon: string | null
  category: string | null
  is_active: boolean
  sort_order: number
}

export function ServicesPage() {
  const { user: currentUser }   = useAuth()
  const toast                   = useToast()
  const [services, setServices] = useState<Skill[]>([])
  const [loading, setLoading]   = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Modal State
  const [showModal, setShowModal]       = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [name, setName]                 = useState('')
  const [nameHi, setNameHi]             = useState('')
  const [icon, setIcon]                 = useState('⚡')
  const [category, setCategory]         = useState('electrical')
  const [sortOrder, setSortOrder]       = useState(1)
  const [isActive, setIsActive]         = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  async function fetchServices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) console.error('Fetch skills error:', error)
    setServices((data ?? []) as Skill[])
    setLoading(false)
  }

  useEffect(() => { fetchServices() }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [showModal])

  // Fast 1-Click Interactive Toggle for Active / Disabled
  async function handleToggleActive(skill: Skill) {
    const nextState = !skill.is_active
    setTogglingId(skill.id)
    // Optimistic UI update
    setServices(prev => prev.map(s => s.id === skill.id ? { ...s, is_active: nextState } : s))

    try {
      const { error: updateErr } = await supabase
        .from('skills')
        .update({ is_active: nextState })
        .eq('id', skill.id)

      if (updateErr) throw updateErr
      toast.success(`Service "${skill.name}" is now ${nextState ? 'Active' : 'Disabled'}`)

      logAdminAction({
        actor: currentUser,
        action: 'Service Status Changed',
        targetType: 'service',
        targetId: skill.id,
        details: `changed service "${skill.name}" status to ${nextState ? 'Active' : 'Disabled / Inactive'}`,
      })
    } catch (err: any) {
      // Rollback on failure
      setServices(prev => prev.map(s => s.id === skill.id ? { ...s, is_active: !nextState } : s))
      toast.error('Failed to update status: ' + (err.message || 'Unknown error'))
    } finally {
      setTogglingId(null)
    }
  }

  function openCreateModal() {
    setEditingSkill(null)
    setName('')
    setNameHi('')
    setIcon('🔧')
    setCategory('general')
    setSortOrder(services.length + 1)
    setIsActive(true)
    setError('')
    setShowModal(true)
  }

  function openEditModal(skill: Skill) {
    setEditingSkill(skill)
    setName(skill.name)
    setNameHi(skill.name_hi ?? '')
    setIcon(skill.icon ?? '🔧')
    setCategory(skill.category ?? 'general')
    setSortOrder(skill.sort_order ?? 1)
    setIsActive(skill.is_active)
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (editingSkill) {
        // UPDATE
        const { error: err } = await supabase
          .from('skills')
          .update({
            name,
            name_hi: nameHi || null,
            icon,
            category,
            sort_order: sortOrder,
            is_active: isActive,
          })
          .eq('id', editingSkill.id)
        if (err) throw err
        toast.success(`Service "${name}" updated successfully!`)

        logAdminAction({
          actor: currentUser,
          action: 'Service Updated',
          targetType: 'service',
          targetId: editingSkill.id,
          details: `updated service "${name}" (Category: ${category})`,
        })
      } else {
        // CREATE
        const { data: newSkill, error: err } = await supabase
          .from('skills')
          .insert({
            name,
            name_hi: nameHi || null,
            icon,
            category,
            sort_order: sortOrder,
            is_active: isActive,
          })
          .select('id')
          .single()
        if (err) throw err
        toast.success(`Service "${name}" added!`)

        logAdminAction({
          actor: currentUser,
          action: 'Service Created',
          targetType: 'service',
          targetId: newSkill?.id,
          details: `created new service "${name}" in category "${category}"`,
        })
      }

      setShowModal(false)
      await fetchServices()
    } catch (err: any) {
      toast.error(err.message || 'Operation failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, serviceName: string) {
    if (!confirm(`Are you sure you want to delete service "${serviceName}"?`)) return
    try {
      const { error } = await supabase.from('skills').delete().eq('id', id)
      if (error) throw error
      toast.success(`Service "${serviceName}" deleted`)

      logAdminAction({
        actor: currentUser,
        action: 'Service Deleted',
        targetType: 'service',
        targetId: id,
        details: `permanently deleted service "${serviceName}"`,
      })

      await fetchServices()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }

  const columns: Column<Skill>[] = [
    {
      key: 'sort_order',
      header: 'Order',
      width: '80px',
      render: s => <strong>#{s.sort_order}</strong>
    },
    {
      key: 'name',
      header: 'Icon & Name',
      searchValue: s => `${s.name} ${s.category ?? ''}`,
      render: s => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '0.5rem',
            background: s.is_active ? 'var(--gray-100)' : 'var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--gray-200)'
          }}>
            <ServiceIcon name={s.name} icon={s.icon} category={s.category} size={18} />
          </div>
          <span style={{ color: s.is_active ? 'var(--gray-900)' : 'var(--gray-500)' }}>{s.name}</span>
        </div>
      )
    },

    {
      key: 'category',
      header: 'Category',
      render: s => <span style={{ textTransform: 'capitalize', color: 'var(--gray-500)' }}>{s.category || 'general'}</span>
    },
    {
      key: 'is_active',
      header: 'Status (Active / Disabled)',
      render: s => {
        const isToggling = togglingId === s.id
        return (
          <button
            type="button"
            onClick={() => handleToggleActive(s)}
            disabled={isToggling}
            title={`Click to ${s.is_active ? 'Disable' : 'Activate'} ${s.name}`}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: isToggling ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '9999px',
              outline: 'none',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: 44,
                height: 24,
                borderRadius: 9999,
                background: s.is_active ? '#10b981' : '#cbd5e1',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                boxShadow: s.is_active ? '0 2px 6px rgba(16, 185, 129, 0.35)' : 'none',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: 3,
                  transform: s.is_active ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.is_active ? (
                  <Check size={11} style={{ color: '#10b981', strokeWidth: 3 }} />
                ) : (
                  <X size={11} style={{ color: '#94a3b8', strokeWidth: 3 }} />
                )}
              </div>
            </div>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: s.is_active ? '#059669' : '#64748b',
                minWidth: '55px',
                textAlign: 'left'
              }}
            >
              {s.is_active ? 'Active' : 'Disabled'}
            </span>
          </button>
        )
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: s => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(s)}>
            <Edit3 size={13} /> Edit
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id, s.name)}>
            <Trash2 size={13} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Services & Skills</h1>
          <p className="page-subtitle">Manage service categories offered on MistriJi</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={fetchServices} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add New Service
          </button>
        </div>
      </div>

      <DataTable
        data={services}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search services by name or category…"
        defaultPageSize={10}
        emptyMessage="No services configured"
        emptyIcon="⚡"
      />

      {/* Modal */}
      {showModal && (
        <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {editingSkill ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingSkill ? 'Edit Service / Skill' : 'Add New Service'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Configure trade names, emojis, and catalog display
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
                  <label className="label">Service Name *</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Electrician" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="label">Icon (Emoji) *</label>
                    <input className="input" value={icon} onChange={e => setIcon(e.target.value)} required placeholder="⚡" />
                  </div>
                  <div>
                    <label className="label">Category Group</label>
                    <input className="input" value={category} onChange={e => setCategory(e.target.value)} placeholder="electrical" />
                  </div>
                  <div>
                    <label className="label">Sort Order</label>
                    <input type="number" className="input" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="isActive" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Active & visible on customer app & website</label>
                </div>
              </div>

              <div style={modalStyles.footer}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
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
    maxWidth: 500,
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
