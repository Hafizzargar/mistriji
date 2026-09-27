import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { logAdminAction } from '@/lib/auditLogger'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Plus, Edit3, Trash2, X, RefreshCw, Sparkles, Check, Loader2, UserPlus, ArrowLeft, ShieldCheck, ChevronRight } from 'lucide-react'
import { JAMMU_AREAS, JAMMU_DISTRICT_OPTIONS, getAreasForDistrict } from '@/lib/jammuCoordinates'

interface Customer {
  id: string
  phone: string
  email: string | null
  status: string
  created_at: string
  profiles: { name: string; area: string; city: string; district?: string; pincode?: string; photo_url?: string | null } | null
}

function getCustomerProfile(c: Customer) {
  if (!c.profiles) return null
  if (Array.isArray(c.profiles)) return (c.profiles as any)[0] || null
  return c.profiles
}

interface PhoneCheckState {
  status: 'idle' | 'checking' | 'available' | 'taken'
  message?: string
}

const TEST_JAMMU_CUSTOMERS = [
  { name: 'Ananya Sharma', district: 'Jammu', area: 'Gandhi Nagar' },
  { name: 'Rahul Dogra', district: 'Jammu', area: 'Trikuta Nagar' },
  { name: 'Simran Kour', district: 'Jammu', area: 'Channi Himmat' },
  { name: 'Sahil Mahajan', district: 'Jammu', area: 'Bahu Fort' },
  { name: 'Pooja Jamwal', district: 'Jammu', area: 'Janipur' },
  { name: 'Rohit Verma', district: 'Jammu', area: 'Talab Tillo' },
  { name: 'Priya Slathia', district: 'Samba', area: 'Vijaypur' },
  { name: 'Neha Gupta', district: 'Jammu', area: 'Shastri Nagar' }
]

function getCustomerSuspensionReason(c: Customer): string {
  const p = getCustomerProfile(c)
  const photo = p?.photo_url
  if (photo && photo.startsWith('suspension_reason:')) {
    return photo.replace('suspension_reason:', '')
  }
  return ''
}

export function CustomersPage() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [testRunning, setTestRunning] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  const [name, setName]                       = useState('')
  const [phone, setPhone]                     = useState('')
  const [email, setEmail]                     = useState('')
  const [district, setDistrict]               = useState('Jammu')
  const [area, setArea]                       = useState('Gandhi Nagar')
  const [pincode, setPincode]                 = useState('180004')
  const [status, setStatus]                   = useState('active')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [saving, setSaving]                   = useState(false)
  const [phoneCheck, setPhoneCheck]           = useState<PhoneCheckState>({ status: 'idle' })

  const districtOptions = JAMMU_DISTRICT_OPTIONS
  const areaOptions = useMemo(() => getAreasForDistrict(district || 'Jammu'), [district])

  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    const viewId = searchParams.get('view')
    if (viewId && customers.length > 0) {
      if (!editingCustomer || editingCustomer.id !== viewId) {
        const toView = customers.find(c => c.id === viewId)
        if (toView) {
          const p = getCustomerProfile(toView)
          setEditingCustomer(toView)
          setName(p?.name ?? '')
          setPhone(toView.phone)
          setEmail(toView.email ?? '')
          setDistrict(p?.district ?? 'Jammu')
          setArea(p?.area ?? 'Gandhi Nagar')
          setPincode(p?.pincode ?? '180004')
          setStatus(toView.status)
          setSuspensionReason(getCustomerSuspensionReason(toView) || '')
          setPhoneCheck({ status: 'idle' })
        }
      }
    } else if (!viewId && editingCustomer) {
      setEditingCustomer(null)
    }
  }, [searchParams, customers, editingCustomer])

  async function fetchCustomers() {
    setLoading(true)
    const res = await supabase
      .from('users')
      .select(`
        id, phone, email, status, created_at,
        profiles (name, area, city, district, pincode, photo_url)
      `)
      .eq('role', 'customer')
      .order('created_at', { ascending: false })

    if (res.error) {
      console.error('Fetch customers error:', res.error)
      toast.error('Failed to load customers: ' + res.error.message)
    }
    setCustomers((res.data ?? []) as unknown as Customer[])
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  useEffect(() => {
    if (areaOptions.length > 0 && !areaOptions.includes(area)) {
      const newArea = areaOptions[0]
      setArea(newArea)
      setPincode(JAMMU_AREAS[newArea]?.pincode || '180004')
    }
  }, [district, areaOptions, area])

  function handleAreaChange(newArea: string) {
    setArea(newArea)
    if (JAMMU_AREAS[newArea]?.pincode) {
      setPincode(JAMMU_AREAS[newArea].pincode)
    }
  }

  useEffect(() => {
    const cleanPhone = phone.replace(/^\\+91/, '').trim()

    if (cleanPhone.length < 10 || !/^[6-9]\\d{9}$/.test(cleanPhone)) {
      setPhoneCheck({ status: 'idle' })
      return
    }

    setPhoneCheck({ status: 'checking', message: 'Checking phone availability…' })

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, role, status, phone, profiles(name, area)')
          .eq('phone', cleanPhone)
          .maybeSingle()

        if (error) throw error

        if (data) {
          if (editingCustomer && editingCustomer.id === data.id) {
            setPhoneCheck({ status: 'available', message: '✓ Current customer number' })
          } else {
            const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
            const userName = profile?.name ? `"${profile.name}"` : 'an existing user'
            setPhoneCheck({
              status: 'taken',
              message: `Already registered to ${userName} (${data.role.toUpperCase()})`
            })
          }
        } else {
          setPhoneCheck({
            status: 'available',
            message: '✓ Phone number is available for new customer account'
          })
        }
      } catch (err: any) {
        console.error('Customer phone check error:', err)
        setPhoneCheck({ status: 'idle' })
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [phone, editingCustomer])

  useEffect(() => {
    if (deletingCustomer) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [deletingCustomer])

  function openEditModal(c: Customer) {
    setSearchParams({ view: c.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleQuickFillTest = useCallback(() => {
    const item = TEST_JAMMU_CUSTOMERS[Math.floor(Math.random() * TEST_JAMMU_CUSTOMERS.length)]
    const randomPhone = '98' + Math.floor(10000000 + Math.random() * 90000000)
    const randomEmail = `${item.name.toLowerCase().replace(/s+/g, '.')}.${Math.floor(100 + Math.random() * 900)}@testjammu.in`
    const distAreas = getAreasForDistrict(item.district)
    const randomArea = distAreas[Math.floor(Math.random() * distAreas.length)] || item.area
    const pin = JAMMU_AREAS[randomArea]?.pincode || '180004'

    setName(item.name)
    setPhone(randomPhone)
    setEmail(randomEmail)
    setDistrict(item.district)
    setArea(randomArea)
    setPincode(pin)
    setStatus('active')
    setSuspensionReason('')
    toast.success(`Filled sample customer data for ${item.name}!`)
  }, [toast])

  async function handleRunTestCustomer() {
    setTestRunning(true)
    const item = TEST_JAMMU_CUSTOMERS[Math.floor(Math.random() * TEST_JAMMU_CUSTOMERS.length)]
    const randomPhone = '98' + Math.floor(10000000 + Math.random() * 90000000)
    const randomEmail = `${item.name.toLowerCase().replace(/s+/g, '.')}.${Math.floor(100 + Math.random() * 900)}@testjammu.in`
    const distAreas = getAreasForDistrict(item.district)
    const randomArea = distAreas[Math.floor(Math.random() * distAreas.length)] || item.area
    const pin = JAMMU_AREAS[randomArea]?.pincode || '180004'

    try {
      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          phone: randomPhone,
          email: randomEmail,
          role: 'customer',
          status: 'active'
        })
        .select('id')
        .single()

      if (userErr) throw userErr
      if (!newUser) throw new Error('Could not create user record.')

      await supabase.from('profiles').insert({
        user_id: newUser.id,
        name: item.name,
        area: randomArea,
        city: item.district || 'Jammu',
        district: item.district,
        pincode: pin,
        photo_url: null
      })

      toast.success(`🧪 Test customer "${item.name}" (+91 ${randomPhone}) created & tested successfully!`)
      await fetchCustomers()
    } catch (err: any) {
      console.error('Test customer create error:', err)
      toast.error(err.message || 'Failed to create test customer.')
    } finally {
      setTestRunning(false)
    }
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault()

    if (phoneCheck.status === 'taken') {
      toast.error('Cannot save: A user with this mobile number is already registered.')
      return
    }

    setSaving(true)
    const cleanPhone = phone.replace(/^\\+91/, '').trim()
    const storedPhotoUrl = status === 'suspended'
      ? `suspension_reason:${suspensionReason.trim() || 'Account suspended by administration.'}`
      : null

    try {
      if (editingCustomer) {
        // Update user
        const { error: userErr } = await supabase.from('users').update({
          phone: cleanPhone,
          email: email.trim() || null,
          status
        }).eq('id', editingCustomer.id)
        if (userErr) throw userErr

        const { error: profErr } = await supabase.from('profiles').update({
          name: name.trim(),
          district,
          city: district,
          area,
          pincode,
          photo_url: storedPhotoUrl
        }).eq('user_id', editingCustomer.id)
        if (profErr) throw profErr

        logAdminAction({
          action: 'update_customer',
          details: `Updated customer ${name}`,
          actor: currentUser ? { id: currentUser.id } : null,
          targetId: editingCustomer.id
        })
        toast.success(`Updated ${name} successfully`)
      }
      setSearchParams({})
      fetchCustomers()
    } catch (err: any) {
      toast.error('Failed to save customer: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingCustomer) return
    try {
      const { error } = await supabase.from('users').delete().eq('id', deletingCustomer.id)
      if (error) throw error
      toast.success('Customer deleted successfully')
      setDeletingCustomer(null)
      fetchCustomers()
    } catch (err: any) {
      toast.error('Failed to delete customer: ' + err.message)
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: c => {
        const p = getCustomerProfile(c)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#64748b' }}>
              {p?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{p?.name || 'Unknown'}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.phone}</div>
            </div>
          </div>
        )
      }
    },
    {
      key: 'location',
      header: 'Location',
      render: c => {
        const p = getCustomerProfile(c)
        return (
          <div>
            <div style={{ fontWeight: 500, color: '#334155' }}>{p?.area || 'No Area'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p?.district || 'Jammu'} • {p?.pincode}</div>
          </div>
        )
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: c => (
        <span className={`badge badge-${c.status === 'active' ? 'success' : 'danger'}`}>
          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
        </span>
      )
    },
    {
      key: 'created_at',
      header: 'Joined Date',
      render: c => <span>{new Date(c.created_at).toLocaleDateString()}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: c => (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button className="btn btn-xs btn-primary" onClick={() => openEditModal(c)}>
            View Details
          </button>
        </div>
      )
    }
  ]

  if (editingCustomer) {
    return (
      <div className="admin-content" style={{ animation: 'fadeIn 0.2s ease', minHeight: '100vh', paddingBottom: '3rem' }}>
        {/* Detail Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1.5rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => { setEditingCustomer(null); setSearchParams({}); }}
            style={{ padding: '0.5rem' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button 
                onClick={() => { setEditingCustomer(null); setSearchParams({}); }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                className="hover-text"
              >
                Customers
              </button>
              <ChevronRight size={14} color="#94a3b8" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>Profile</span>
            </div>
            <h1 className="page-title">{name || 'Customer Profile'}</h1>
            <p className="page-subtitle">Manage details, history, and status for {name}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Edit Form */}
          <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Edit Details
              </h3>
            </div>
            
            <form onSubmit={saveCustomer}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label">Full Name *</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label">District *</label>
                  <select className="input" value={district} onChange={e => setDistrict(e.target.value)}>
                    {JAMMU_DISTRICT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Area *</label>
                  <select className="input" value={area} onChange={e => handleAreaChange(e.target.value)}>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" value={pincode} onChange={e => setPincode(e.target.value)} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Status / Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: status === 'active' ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', border: `1px solid ${status === 'active' ? '#bbf7d0' : '#fecaca'}` }}>
                  <div>
                    <div style={{ fontWeight: 700, color: status === 'active' ? '#15803d' : '#dc2626' }}>
                      {status === 'active' ? 'Account Active' : 'Account Disabled'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {status === 'active' ? 'Customer can login and book jobs' : 'Customer cannot login'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newStatus = status === 'active' ? 'disabled' : 'active'
                      setStatus(newStatus)
                      supabase.from('users').update({ status: newStatus }).eq('id', editingCustomer.id).then(() => {
                        toast.success(newStatus === 'active' ? 'Account enabled' : 'Account disabled')
                        fetchCustomers()
                      })
                    }}
                    className={`btn btn-sm ${status === 'active' ? 'btn-danger' : 'btn-success'}`}
                  >
                    {status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                
                {status === 'disabled' && (
                  <div>
                    <label className="label">Disable Reason</label>
                    <input className="input" value={suspensionReason} onChange={e => setSuspensionReason(e.target.value)} placeholder="e.g. Violation of terms" />
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#334155' }}>Delete Account</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Permanently remove customer</div>
                  </div>
                  <button onClick={() => setDeletingCustomer(editingCustomer)} className="btn btn-sm btn-danger">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage registered consumer accounts across Jammu & Kashmir</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRunTestCustomer}
            disabled={loading || testRunning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 700,
              background: '#f0fdf4',
              borderColor: '#86efac',
              color: '#15803d'
            }}
            title="Auto-create and test a realistic Jammu customer account"
          >
            <Sparkles size={15} style={{ color: '#16a34a' }} />
            <span>{testRunning ? 'Testing...' : '🧪 Test Add Customer'}</span>
          </button>

          <button className="btn btn-secondary" onClick={fetchCustomers} title="Refresh list">
            <RefreshCw size={15} />
          </button>

          <Link
            to="/customers/enroll"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
          >
            <UserPlus size={16} /> Enroll Customer
          </Link>
        </div>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search customers by name, phone, area..."
        defaultPageSize={10}
        emptyMessage="No customers found"
        emptyIcon="👤"
      />

      {deletingCustomer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={() => setDeletingCustomer(null)}>
          <div style={{
            background: '#fff', borderRadius: '0.875rem', width: '100%', maxWidth: 420,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#991b1b' }}>Delete Customer?</h3>
              </div>
              <button onClick={() => setDeletingCustomer(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete customer <strong>{deletingCustomer.profiles?.name || deletingCustomer.phone}</strong>?
            </div>
            <div style={{
              padding: '0.875rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
              display: 'flex', justifyContent: 'flex-end', gap: '0.5rem'
            }}>
              <button className="btn btn-secondary" onClick={() => setDeletingCustomer(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
