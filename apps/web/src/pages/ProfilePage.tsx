import React, { useState, useEffect } from 'react'
import {
  X,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  Calendar,
  LogOut,
  Save,
  HardHat,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock
} from 'lucide-react'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { resolveJammuInput } from '@/lib/jammuCoordinates'
import { fetchPlatformFeatures, PlatformFeatures, DEFAULT_PLATFORM_FEATURES, FEATURES_STORAGE_KEY } from '@/lib/settings'

const POPULAR_AREAS = [
  'Gandhi Nagar',
  'Janipur',
  'Trikuta Nagar',
  'Bahu Plaza',
  'Channi Himmat',
  'Talab Tillo',
  'Nanak Nagar',
  'Bakshi Nagar',
  'Katra',
  'Udhampur',
  'Doda',
  'Srinagar',
]

export function ProfilePage() {
  const { customer, isLoggedIn, updateProfile, logout } = useCustomerAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [email, setEmail]             = useState('')
  const [area, setArea]               = useState('Gandhi Nagar')
  const [city, setCity]               = useState('Jammu')
  const [experience, setExperience]   = useState<number>(0)
  const [isAvailable, setIsAvailable] = useState(true)
  const [saving, setSaving]           = useState(false)

  // Sync state with customer data whenever modal opens
  useEffect(() => {
    if (customer) {
      setName(customer.name || '')
      setPhone(customer.phone || '')
      setEmail(customer.email?.includes('@mistriji.local') ? '' : (customer.email || ''))
      setArea(customer.area || 'Gandhi Nagar')
      setCity(customer.city || 'Jammu')
      setExperience(customer.experience_years ?? 2)
      setIsAvailable(customer.is_available ?? true)
    }
  }, [customer])

  const isWorker = customer?.role === 'worker'
  const isAdmin = customer?.role === 'admin' || customer?.role === 'super_admin'

  // Note: Workers and customers can both access this page to update their details

  // Admin Toggles State
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatures>(DEFAULT_PLATFORM_FEATURES)
  useEffect(() => {
    if (isAdmin) {
      fetchPlatformFeatures().then(setPlatformFeatures)
    }
  }, [isAdmin])

  if (!isLoggedIn || !customer) return null

  const toggleAdminFeature = async (key: keyof PlatformFeatures, overrideValue?: any) => {
    const newVal = { 
      ...platformFeatures, 
      [key]: overrideValue !== undefined ? overrideValue : !platformFeatures[key as keyof PlatformFeatures] 
    }
    setPlatformFeatures(newVal)
    
    // Broadcast immediately locally for optimistic UI update
    localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(newVal))
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      new BroadcastChannel('mistriji_settings_channel').postMessage({ type: 'FEATURES_UPDATED', payload: newVal })
    }

    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'platform_features',
        value: newVal as any,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      if (error) throw error
      toast.success('Platform feature updated globally!')
    } catch (err: any) {
      toast.error('Failed to update feature toggle.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter your name.')
      return
    }

    setSaving(true)
    const locationMeta = resolveJammuInput(area.trim())
    const result = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      area: area.trim(),
      city: city.trim(),
      experience_years: isWorker ? Number(experience) : undefined,
      is_available: isWorker ? isAvailable : undefined,
    })



    setSaving(false)
    if (result.success) {
      toast.success('Your profile details have been updated successfully! ✨')
    } else {
      toast.error(result.error || 'Failed to update profile')
    }
  }

  const handleLogout = () => {
    logout()
    toast.info('You have been logged out.')
  }

  const handleViewBookings = () => {
    navigate(isWorker ? '/worker/dashboard' : '/customer/bookings')
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem' }}>
        
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
          
          {/* Left: Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gray-500)', fontSize: '0.9rem', fontWeight: 600 }}>
            <span style={{ cursor: 'pointer', color: 'var(--brand-600)' }} onClick={() => navigate(isWorker ? '/worker/dashboard' : '/customer/dashboard')}>Home</span>
            <span>/</span>
            <span style={{ color: 'var(--gray-900)' }}>My Profile</span>
          </div>

          {/* Right: Account Settings Title */}
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>
              Account Settings
            </h1>
            <p style={{ color: 'var(--gray-500)', marginTop: '0.15rem', fontSize: '0.85rem' }}>
              Manage your personal information and preferences.
            </p>
          </div>

        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Left Column: Profile Card */}
          <div style={{ 
            flex: '1 1 320px', 
            maxWidth: '400px', 
            background: '#ffffff', 
            borderRadius: '1.25rem', 
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.08)', 
            border: '1px solid rgba(226, 232, 240, 0.8)', 
            overflow: 'hidden' 
          }}>
            <div style={{
              background: isWorker
                ? 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)'
                : 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #8b5cf6 100%)',
              padding: '3rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textAlign: 'center'
            }}>
              <div style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                background: '#ffffff',
                color: isWorker ? '#059669' : '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 800,
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                border: '4px solid rgba(255, 255, 255, 0.9)',
                textTransform: 'uppercase',
                marginBottom: '1.25rem'
              }}>
                {name ? name[0] : (isWorker ? 'W' : 'C')}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {name || 'My Profile'}
              </h2>
              <span style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}>
                {isWorker ? <HardHat size={14} /> : <ShoppingBag size={14} />}
                {isWorker ? 'Worker Partner' : 'Customer Account'}
              </span>
            </div>

            <div style={{ padding: '1.5rem 2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                <Phone size={16} style={{ color: 'var(--gray-400)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--gray-700)', fontWeight: 600, flex: 1 }}>+91 {customer.phone}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: '#10b981', background: '#ecfdf5', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
                  <CheckCircle2 size={12} /> Verified
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: isWorker ? '1px solid var(--gray-100)' : 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gray-400)' }}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <span style={{ fontSize: '0.9rem', color: 'var(--gray-700)', fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customer.email || 'No email added'}
                </span>
              </div>

              {isWorker && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '1.25rem', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-500)', fontWeight: 700 }}>Jobs Done</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-600)' }}>{customer.jobs_accepted || 0}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-500)', fontWeight: 700 }}>Rejected</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gray-700)' }}>{customer.jobs_rejected || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Edit Form */}
          <div style={{ 
            flex: '1 1 500px', 
            background: '#ffffff', 
            borderRadius: '1.25rem', 
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.08)', 
            border: '1px solid rgba(226, 232, 240, 0.8)',
            padding: '2.5rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={20} style={{ color: 'var(--brand-600)' }} /> Personal Details
            </h3>

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.75rem', fontSize: '0.95rem', width: '100%' }}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Phone Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
                Mobile Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="tel"
                  className="input"
                  style={{ 
                    paddingLeft: '2.75rem', fontSize: '0.95rem', width: '100%',
                    backgroundColor: customer?.phone ? '#f1f5f9' : '#fff',
                    color: customer?.phone ? '#64748b' : '#0f172a',
                    cursor: customer?.phone ? 'not-allowed' : 'text'
                  }}
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="98xxxxxxxx"
                  maxLength={10}
                  readOnly={!!customer?.phone}
                  title={customer?.phone ? "Contact Admin to change verified phone number" : "Add your phone number"}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <input
                  type="email"
                  className="input"
                  style={{ 
                    paddingLeft: '2.75rem', fontSize: '0.95rem', width: '100%',
                    backgroundColor: (customer?.email && !customer?.email.includes('@mistriji.local') && customer?.email !== 'hafezzargar987+cu@gmail.com') ? '#f1f5f9' : '#fff',
                    color: (customer?.email && !customer?.email.includes('@mistriji.local') && customer?.email !== 'hafezzargar987+cu@gmail.com') ? '#64748b' : '#0f172a',
                    cursor: (customer?.email && !customer?.email.includes('@mistriji.local') && customer?.email !== 'hafezzargar987+cu@gmail.com') ? 'not-allowed' : 'text'
                  }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  readOnly={!!(customer?.email && !customer?.email.includes('@mistriji.local') && customer?.email !== 'hafezzargar987+cu@gmail.com')}
                  title={customer?.email && !customer?.email.includes('@mistriji.local') && customer?.email !== 'hafezzargar987+cu@gmail.com' ? "Contact Admin to change verified email" : "Add your email address"}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Area / Locality */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
                Area / Locality in J&K *
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '2.75rem', fontSize: '0.95rem', width: '100%' }}
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="e.g. Gandhi Nagar"
                  required
                />
              </div>
            </div>

            {/* City / District */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
                City / Region
              </label>
              <div style={{ position: 'relative' }}>
                <Building2 size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '2.75rem', fontSize: '0.95rem', width: '100%' }}
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Jammu, J&K"
                />
              </div>
            </div>
          </div>

          {/* Worker Specific Extra Fields */}
          {isWorker && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#166534', fontWeight: 700, fontSize: '0.85rem' }}>
                <HardHat size={16} />
                <span>Mistri / Worker Partner Settings</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="input"
                    value={experience}
                    onChange={e => setExperience(Number(e.target.value))}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>
                    Job Availability
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAvailable(!isAvailable)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.5rem',
                      border: `1.5px solid ${isAvailable ? '#10b981' : '#cbd5e1'}`,
                      background: isAvailable ? '#dcfce7' : '#f1f5f9',
                      color: isAvailable ? '#15803d' : '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAvailable ? '#10b981' : '#94a3b8' }} />
                    {isAvailable ? '🟢 Accepting Jobs' : '⚪ Busy / Offline'}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Admin Settings Section */}
          {isAdmin && (
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShieldCheck size={18} style={{ color: 'var(--brand-600)' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-900)' }}>Platform Features (Admin)</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>Booking Assignment Mode</span>
                    <span style={{ fontSize: '0.75rem', color: platformFeatures.assignment_mode === 'manual' ? '#eab308' : 'var(--gray-500)' }}>
                      {platformFeatures.assignment_mode === 'manual' ? 'Manual Dispatch (Admin Control)' : 'Auto-Broadcast (Instant)'}
                    </span>
                  </div>
                  <input type="checkbox" className="toggle toggle-warning toggle-sm" checked={platformFeatures.assignment_mode === 'manual'} onChange={() => toggleAdminFeature('assignment_mode', platformFeatures.assignment_mode === 'manual' ? 'auto' : 'manual')} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>Allow Direct Calling</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Show "Call" buttons on worker profiles</span>
                  </div>
                  <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={platformFeatures.allow_direct_calls} onChange={() => toggleAdminFeature('allow_direct_calls')} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>Show Worker Phones</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Display actual numbers instead of "Call Now"</span>
                  </div>
                  <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={platformFeatures.show_worker_phones} onChange={() => toggleAdminFeature('show_worker_phones')} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>Show Preferred Time</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Allow customers to pick arrival date/time</span>
                  </div>
                  <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={platformFeatures.show_preferred_time} onChange={() => toggleAdminFeature('show_preferred_time')} />
                </label>

              </div>
            </div>
          )}

              {/* Save Button */}
              <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    padding: '0.85rem 2rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                    minWidth: '200px',
                    justifyContent: 'center'
                  }}
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
