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

export function UserProfileModal() {
  const { customer, isLoggedIn, showProfileModal, closeProfileModal, updateProfile, logout } = useCustomerAuth()
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
  }, [customer, showProfileModal])

  const isWorker = customer?.role === 'worker'
  const isAdmin = customer?.role === 'admin' || customer?.role === 'super_admin'

  // Admin Toggles State
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatures>(DEFAULT_PLATFORM_FEATURES)
  useEffect(() => {
    if (isAdmin && showProfileModal) {
      fetchPlatformFeatures().then(setPlatformFeatures)
    }
  }, [isAdmin, showProfileModal])

  if (!isLoggedIn || !showProfileModal || !customer) return null

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
      closeProfileModal()
    } else {
      toast.error(result.error || 'Failed to update profile')
    }
  }

  const handleLogout = () => {
    closeProfileModal()
    logout()
    toast.info('You have been logged out.')
  }

  const handleViewBookings = () => {
    closeProfileModal()
    navigate('/my-bookings')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.25rem',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          position: 'relative',
        }}
      >
        {/* Header Ribbon / Banner */}
        <div
          style={{
            background: isWorker
              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #8b5cf6 100%)',
            padding: '1.5rem 1.5rem 2rem',
            borderTopLeftRadius: '1.25rem',
            borderTopRightRadius: '1.25rem',
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeProfileModal}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            title="Close"
          >
            <X size={18} />
          </button>

          {/* User identity & Role info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#ffffff',
                color: isWorker ? '#059669' : '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.65rem',
                fontWeight: 800,
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                border: '3px solid rgba(255, 255, 255, 0.8)',
                flexShrink: 0,
                textTransform: 'uppercase',
              }}
            >
              {name ? name[0] : (isWorker ? 'W' : 'C')}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  {name || 'My Profile'}
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {isWorker ? <HardHat size={12} /> : <ShoppingBag size={12} />}
                  {isWorker ? 'Worker Partner' : 'Customer Account'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.85rem', opacity: 0.95 }}>
                <Phone size={13} />
                <span>+91 {customer.phone}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.7rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={11} /> Verified
                </span>
              </div>
              {isWorker && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontWeight: 700 }}>Jobs Accepted</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{customer.jobs_accepted || 0}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontWeight: 700 }}>Jobs Rejected</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{customer.jobs_rejected || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.25rem', fontSize: '0.9rem', width: '100%' }}
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
                <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="tel"
                  className="input"
                  style={{ 
                    paddingLeft: '2.25rem', fontSize: '0.9rem', width: '100%',
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <input
                  type="email"
                  className="input"
                  style={{ 
                    paddingLeft: '2.25rem', fontSize: '0.9rem', width: '100%',
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

          {/* Area / Locality */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
              Area / Locality in J&K *
            </label>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.25rem', fontSize: '0.9rem', width: '100%' }}
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="e.g. Gandhi Nagar, Janipur, Katra"
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
              <Building2 size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.25rem', fontSize: '0.9rem', width: '100%' }}
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Jammu, J&K"
              />
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
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '0.75rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            {saving ? (
              <span>Saving Changes...</span>
            ) : (
              <>
                <Save size={16} />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>

          {/* Quick Nav Items & Logout */}
          <div
            style={{
              borderTop: '1px solid var(--gray-200)',
              paddingTop: '1rem',
              marginTop: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleViewBookings}
              className="btn btn-sm btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Calendar size={14} />
              <span>My Bookings</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-sm btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
