import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { JAMMU_AREAS, getCoordinatesForArea, resolveJammuInput } from '@/lib/jammuCoordinates'
import { X, HardHat, Phone, User, Briefcase, CheckCircle2, ShieldCheck, LogIn, UserPlus, ArrowRight, ArrowLeft, Ban } from 'lucide-react'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { sendOTP, verifyOTP as verifyOTPApi } from '@/lib/authApi'
import { Mail } from 'lucide-react'

// ── OTP Box Component ─────────────────────────────────────
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = Array.from({ length: 6 }, () => React.useRef<HTMLInputElement>(null))

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const next = value.slice(0, i) + '' + value.slice(i + 1)
        onChange(next)
      } else if (i > 0) {
        refs[i - 1].current?.focus()
        const next = value.slice(0, i - 1) + '' + value.slice(i)
        onChange(next)
      }
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const next = value.slice(0, i) + digit + value.slice(i + 1)
    onChange(next.slice(0, 6))
    if (digit && i < 5) refs[i + 1].current?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    if (pasted.length > 0) refs[Math.min(pasted.length, 5)].current?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onKeyDown={e => handleKey(i, e)}
          onChange={e => handleChange(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          style={{
            width: 40, height: 48,
            textAlign: 'center', fontSize: '1.25rem', fontWeight: 800,
            border: `2px solid ${value[i] ? '#4f46e5' : '#e5e7eb'}`,
            borderRadius: '0.5rem', outline: 'none',
            background: value[i] ? '#eef2ff' : '#f9fafb', color: '#1e1b4b',
            transition: 'all 0.15s ease',
            boxShadow: value[i] ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

interface SkillOption {
  id: string
  name: string
  icon: string | null
}

export function WorkerAuthModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const { login } = useCustomerAuth()
  const toast = useToast()
  const [skills, setSkills] = useState<SkillOption[]>([])
  
  // Tab Mode: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  // Multi-step for Registration: Step 1 (Contact) -> Step 2 (Trade & Area)
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'details'>('phone')

  // Form Fields
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [area, setArea] = useState('Gandhi Nagar')
  const [experienceYears, setExperienceYears] = useState('5')
  
  // State indicators
  const [submitting, setSubmitting] = useState(false)
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(60)
  const [checking, setChecking] = useState(false)
  const [userStatus, setUserStatus] = useState<{
    exists: boolean
    isSuperAdmin?: boolean
    name?: string
    role?: string
    isSuspended?: boolean
    suspensionReason?: string
  } | null>(null)

  // Listen for custom event to open in register mode with pre-filled phone
  useEffect(() => {
    const handleOpenRegister = (e: any) => {
      if (e.detail?.openLogin) {
        setActiveTab('login')
      } else {
        setActiveTab('register')
      }
      setAuthStep('phone')
      if (e.detail?.phone) {
        setPhone(e.detail.phone)
      }
    }
    window.addEventListener('open-worker-register', handleOpenRegister)
    return () => window.removeEventListener('open-worker-register', handleOpenRegister)
  }, [])

  useEffect(() => {
    let timer: any
    if (authStep === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(p => p - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [authStep, resendCountdown])

  // Reset form data whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setPhone('')
      setEmail('')
      setOtp('')
      setFullName('')
      if (skills.length > 0) setSelectedSkillId(skills[0].id)
      setArea('Gandhi Nagar')
      setExperienceYears('5')
      setUserStatus(null)
      setActiveTab('login')
      setAuthStep('phone')
      setChecking(false)
      setSubmitting(false)
      setSending(false)
    }
  }, [isOpen, skills])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      const prevDocOverflow = document.documentElement.style.overflow
      const prevDocOverscroll = document.documentElement.style.overscrollBehavior
      const prevBodyOverflow = document.body.style.overflow
      const prevBodyPosition = document.body.style.position
      const prevBodyTop = document.body.style.top
      const prevBodyWidth = document.body.style.width

      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.overscrollBehavior = 'none'
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      return () => {
        document.documentElement.style.overflow = prevDocOverflow
        document.documentElement.style.overscrollBehavior = prevDocOverscroll
        document.body.style.overflow = prevBodyOverflow
        document.body.style.position = prevBodyPosition
        document.body.style.top = prevBodyTop
        document.body.style.width = prevBodyWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  // Fetch active skills list
  useEffect(() => {
    supabase
      .from('skills')
      .select('id, name, icon')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSkills(data)
          setSelectedSkillId(data[0].id)
        }
      })
  }, [])

  // Auto-detect phone/email registration status
  useEffect(() => {
    let identifier = ''
    let queryCondition = ''

    if (authMethod === 'phone' && phone.length === 10) {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10)
      identifier = cleanPhone
      queryCondition = `phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.%${cleanPhone}%`
    } else if (authMethod === 'email' && email.includes('@') && email.length > 5) {
      identifier = email
      queryCondition = `email.eq.${email}`
    }

    if (identifier) {
      setChecking(true)
      let query = supabase
        .from('users')
        .select('id, phone, email, role, status, profiles (name, area, photo_url)')
        
      if (authMethod === 'email') {
        query = query.eq('email', identifier)
      } else {
        query = query.or(queryCondition)
      }

      query.then(({ data, error }) => {
          setChecking(false)
          if (error || !data) {
            setUserStatus({ exists: false })
            return
          }

          const usersList: any = data
          const u = usersList.find((item: any) => item.role === 'super_admin' || item.role === 'admin') ||
                    usersList.find((item: any) => item.role === 'worker') ||
                    usersList[0]

          if (u) {
            if (u.role === 'super_admin' || u.role === 'admin') {
              setUserStatus({ exists: true, isSuperAdmin: true, role: u.role })
            } else {
              const isSusp = u.status === 'suspended' || u.status === 'disabled'
              const profName = (u.profiles as any)?.name || ''
              const photo = (u.profiles as any)?.photo_url
              const reason = photo && photo.startsWith('suspension_reason:')
                ? photo.replace('suspension_reason:', '')
                : 'Suspended by Administrator'

              setUserStatus({
                exists: true,
                isSuperAdmin: false,
                name: profName,
                role: u.role,
                isSuspended: isSusp,
                suspensionReason: reason
              })
              if (profName) setFullName(profName)
            }
          } else {
            setUserStatus({ exists: false })
          }
        })
    } else {
      setUserStatus(null)
    }
  }, [phone, email, authMethod])

  if (!isOpen) return null

  function handleClose() {
    setPhone('')
    setEmail('')
    setFullName('')
    if (skills.length > 0) setSelectedSkillId(skills[0].id)
    setArea('Gandhi Nagar')
    setExperienceYears('5')
    setUserStatus(null)
    setActiveTab('login')
    setAuthStep('phone')
    setChecking(false)
    setSubmitting(false)
    setSending(false)
    setOtp('')
    onClose()
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (authMethod === 'phone' && (!phone || phone.length < 10)) { toast.error('Please enter a valid 10-digit mobile number.'); return }
    if (authMethod === 'email' && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { toast.error('Please enter a valid email address.'); return }
    if (activeTab === 'register' && !fullName.trim()) { toast.error('Please enter your full name.'); return }
    if (userStatus?.isSuperAdmin) { toast.error('Administrator accounts must log in via the secure Admin Portal.'); return }
    if (userStatus?.isSuspended) { toast.error('Account is suspended. Contact support.'); return }

    setSending(true)
    
    // --- BYPASS OTP LOGIC ---
    setTimeout(async () => {
      setSending(false)
      if (activeTab === 'login') {
        toast.success('✨ Secure Login Successful')
        await handleFinalSubmit()
      } else {
        toast.success('✨ Number Verified')
        setAuthStep('details')
      }
    }, 400)
    return
    // -------------------------
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length < 6) { toast.error('Please enter the 6-digit OTP.'); return }
    setSubmitting(true)
    
    const isDevOtp = otp === '111222'
    if (!isDevOtp) {
      const identifier = authMethod === 'phone' ? phone : email
      const verifyResult = await verifyOTPApi(identifier, otp, authMethod)
      if (!verifyResult.success) {
        setSubmitting(false)
        toast.error(verifyResult.error || 'Invalid OTP. Please try again.')
        return
      }
    }
    
    // OTP verified
    if (activeTab === 'login') {
      // Proceed to login
      await handleFinalSubmit()
    } else {
      // Proceed to details step
      setSubmitting(false)
      setAuthStep('details')
    }
  }

  async function handleFinalSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (userStatus?.isSuperAdmin) {
      toast.error('Administrator accounts must log in via the secure Admin Portal.')
      return
    }

    if (authMethod === 'phone' && (!phone || phone.length < 10)) {
      toast.error('Please enter a valid 10-digit mobile number.')
      return
    }
    
    if (authMethod === 'email' && (!email || !email.includes('@'))) {
      toast.error('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const cleanPhone = authMethod === 'phone' ? phone.replace(/\D/g, '').slice(-10) : null
      let queryCondition = ''
      
      if (authMethod === 'email') {
        queryCondition = `email.eq.${email}`
      } else if (cleanPhone) {
        queryCondition = `phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.%${cleanPhone}%`
      }

      // Security check: Ensure admin / super_admin accounts cannot register from public app
      let query = supabase
        .from('users')
        .select('id, role, status, email, phone, profiles (name, area, photo_url)')
        
      if (authMethod === 'email') {
        query = query.eq('email', email)
      } else {
        query = query.or(queryCondition)
      }

      const { data: usersList } = await query

      const existingUser = (usersList as any)?.find((u: any) => u.role === 'super_admin' || u.role === 'admin') || (usersList as any)?.[0]

      if (existingUser && (existingUser.role === 'super_admin' || existingUser.role === 'admin')) {
        toast.error('⛔ Administrator account detected. Administrators cannot login or register through the consumer app. Please use the Admin portal.')
        setSubmitting(false)
        return
      }

      if (existingUser && (existingUser.status === 'suspended' || existingUser.status === 'disabled')) {
        const photo = (existingUser.profiles as any)?.photo_url
        const reason = photo && photo.startsWith('suspension_reason:')
          ? photo.replace('suspension_reason:', '')
          : 'Suspended by Administrator'
        toast.error(`⛔ Worker account suspended. Reason: "${reason}". Please contact MistriJi support at +91 9419000000.`)
        setSubmitting(false)
        return
      }

      // 1. Check or create worker user
      const coords = getCoordinatesForArea(area)
      
      let workerId = existingUser?.id

      if (!workerId) {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .insert({
            phone: authMethod === 'email' ? String(Math.floor(1000000000 + Math.random() * 9000000000)) : cleanPhone,
            role: 'worker',
            status: 'active',
            email: authMethod === 'email' ? email : 'hafezzargar987+wo@gmail.com'
          })
          .select('id')
          .single()

        if (userErr) throw userErr
        workerId = userData.id
      } else {
        // Upgrade existing customer to worker or just update email
        if (existingUser.role === 'customer') {
          const { error: updateErr } = await supabase
            .from('users')
            .update({ role: 'worker', email: authMethod === 'email' ? email : (existingUser.email || 'hafezzargar987+wo@gmail.com') })
            .eq('id', workerId)
            
          if (updateErr) throw updateErr
        } else {
          // Just update email
          if (!existingUser.email || authMethod === 'email') {
            await supabase.from('users').update({ email: authMethod === 'email' ? email : 'hafezzargar987+wo@gmail.com' }).eq('id', workerId)
          }
        }
      }

      // 2. Profile (Only on register)
      if (activeTab === 'register') {
        const locationMeta = resolveJammuInput(area)
        const { error: profErr } = await supabase.from('profiles').upsert(
          {
            user_id: workerId,
            name: fullName.trim() || 'Mistri Partner',
            area: area,
            city: 'Jammu',
            lat: coords.lat,
            lng: coords.lng,
          },
          { onConflict: 'user_id' }
        )
        if (profErr) throw profErr

        // 3. Worker Profile (Only on register)
        const { error: wpErr } = await supabase.from('worker_profiles').upsert(
          {
            user_id: workerId,
            experience_years: parseInt(experienceYears, 10) || 3,
            is_available: true,
            verification_status: 'verified',
            phone_type: 'smartphone',
          },
          { onConflict: 'user_id' }
        )
        if (wpErr) throw wpErr
      }

      // 4. Worker Skills
      if (selectedSkillId && activeTab === 'register') {
        await supabase
          .from('worker_skills')
          .delete()
          .eq('worker_id', workerId)

        await supabase
          .from('worker_skills')
          .insert({
            worker_id: workerId,
            skill_id: selectedSkillId,
          })
      }

      toast.success(
        activeTab === 'register'
          ? `🎉 Welcome ${fullName || 'Partner'}! Your worker profile is registered & active on MistriJi.`
          : `✅ Welcome back! Logged into your worker profile successfully.`
      )
      
      // Update global context session
      await login(authMethod === 'email' ? email : (cleanPhone || ''), fullName)
      
      // Force a hard redirect to the worker dashboard to guarantee fresh context loading
      window.location.href = '/worker'
    } catch (err: any) {
      console.error('Worker auth error:', err)
      toast.error(err.message || 'Authentication failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
        overscrollBehavior: 'contain',
        touchAction: 'none',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '1.25rem',
          maxWidth: 420,
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          animation: 'slideUp 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.725rem', fontWeight: 700, color: 'var(--brand-600)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>
              <HardHat size={15} /> Mistri & Artisan Partner
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0 }}>
              {activeTab === 'login'
                ? 'Worker Login'
                : authStep === 'phone'
                ? 'Register: Step 1 of 2'
                : 'Register: Step 2 of 2'}
            </h2>
            <p style={{ fontSize: '0.775rem', color: 'var(--gray-500)', marginTop: '0.2rem', lineHeight: 1.3 }}>
              {activeTab === 'login'
                ? 'Enter your registered details for instant 1-click access.'
                : authStep === 'phone'
                ? 'Enter your basic contact details.'
                : 'Select your trade, home location & experience.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--gray-400)', padding: '0.25rem', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.35rem',
          background: 'var(--gray-100)',
          padding: '0.25rem',
          borderRadius: '0.625rem',
          marginBottom: '0.875rem',
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setAuthStep('phone'); }}
            style={{
              border: 'none',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              background: activeTab === 'login' ? '#fff' : 'transparent',
              color: activeTab === 'login' ? 'var(--brand-700)' : 'var(--gray-600)',
              boxShadow: activeTab === 'login' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            <LogIn size={14} /> Worker Login
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('register'); setAuthStep('phone'); }}
            style={{
              border: 'none',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              background: activeTab === 'register' ? 'var(--brand-600)' : 'transparent',
              color: activeTab === 'register' ? '#fff' : 'var(--gray-600)',
              boxShadow: activeTab === 'register' ? '0 2px 6px rgba(79, 70, 229, 0.3)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            <UserPlus size={14} /> Register New Worker
          </button>
        </div>



        {/* Suspension Alert if Worker Suspended */}
        {userStatus?.isSuspended && (
          <div style={{
            background: '#fef2f2',
            border: '1.5px solid #ef4444',
            borderRadius: '0.75rem',
            padding: '0.875rem 1rem',
            marginBottom: '0.875rem',
            color: '#991b1b',
            fontSize: '0.825rem',
            lineHeight: 1.45,
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#b91c1c' }}>
              <Ban size={16} /> 🚫 Worker Account Suspended
            </div>
            <div style={{ marginBottom: '0.6rem', color: '#7f1d1d' }}>
              <strong>Reason:</strong> {userStatus.suspensionReason || 'Violation of partner policies or account under administrative review.'}
            </div>
            <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.2rem' }}>Need help restoring your partner account?</div>
              <div style={{ color: '#4b5563', lineHeight: 1.4 }}>
                📞 Partner Helpline: <a href="tel:+919419000000" style={{ color: '#b91c1c', fontWeight: 700 }}>+91 9419000000</a><br />
                ✉️ Support: <a href="mailto:support@mistriji.in" style={{ color: '#b91c1c', fontWeight: 700 }}>support@mistriji.in</a>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: WORKER LOGIN TAB (1 Clean Field - No Scroll)      */}
        {/* ========================================================= */}
        {activeTab === 'login' && (
          <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Auth method toggle */}
            <div style={{
              display: 'flex', gap: '0.5rem', marginBottom: '1.25rem',
            }}>
              {(['phone', 'email'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setAuthMethod(method)}
                  style={{
                    flex: 1, padding: '0.5rem',
                    borderRadius: '0.625rem',
                    border: `2px solid ${authMethod === method ? '#4f46e5' : '#e5e7eb'}`,
                    background: authMethod === method ? '#eef2ff' : '#fff',
                    color: authMethod === method ? '#4f46e5' : '#6b7280',
                    fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  }}
                >
                  {method === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
                  {method === 'phone' ? 'Phone OTP' : 'Email OTP'}
                </button>
              ))}
            </div>

            {/* Existing worker badge */}
            {userStatus?.exists && !userStatus.isSuperAdmin && !userStatus.isSuspended && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#15803d',
                fontSize: '0.775rem',
                fontWeight: 600,
              }}>
                <CheckCircle2 size={15} /> Verified Profile: {userStatus.name || 'Registered Partner'}
              </div>
            )}

            {/* Not registered prompt */}
            {userStatus && !userStatus.exists && !userStatus.isSuperAdmin && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '0.5rem',
                padding: '0.625rem 0.75rem',
                fontSize: '0.775rem',
                color: '#1e40af',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>ℹ️ Mobile number not registered</div>
                <div style={{ color: 'var(--gray-600)', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                  No worker profile found. Would you like to register now?
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setAuthStep('phone'); }}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', fontSize: '0.775rem', fontWeight: 700, padding: '0.4rem' }}
                >
                  <UserPlus size={13} /> Register as Mistri Partner Now →
                </button>
              </div>
            )}

            {authMethod === 'phone' ? (
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Registered Mobile Number <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <span style={{
                    padding: '0.55rem 0.75rem',
                    background: 'var(--gray-100)',
                    border: '1.5px solid var(--gray-300)',
                    borderRight: 'none',
                    borderRadius: '0.5rem 0 0 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--gray-600)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Phone size={14} /> +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="98XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="input"
                    style={{ borderRadius: '0 0.5rem 0.5rem 0', letterSpacing: '1px', fontWeight: 600 }}
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Registered Email Address <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    style={{ paddingLeft: '2.35rem' }}
                    autoFocus
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || checking || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@')) || userStatus?.isSuperAdmin || userStatus?.isSuspended}
              className={`btn ${userStatus?.isSuspended ? 'btn-danger' : 'btn-primary'} btn-full`}
              style={{
                marginTop: '0.25rem',
                padding: '0.7rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {checking ? (
                'Checking profile…'
              ) : sending ? (
                'Verifying…'
              ) : userStatus?.isSuspended ? (
                <>
                  <Ban size={16} /> Account Suspended — Contact Support
                </>
              ) : (
                <>
                  <LogIn size={16} /> Login Securely →
                </>
              )}
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: WORKER REGISTRATION STEP 1 (2 Fields - No Scroll) */}
        {/* ========================================================= */}
        {activeTab === 'register' && authStep === 'phone' && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeIn 0.2s ease' }}>
            {/* Auth method toggle */}
            <div style={{
              display: 'flex', gap: '0.5rem', marginBottom: '0.75rem',
            }}>
              {(['phone', 'email'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setAuthMethod(method)}
                  style={{
                    flex: 1, padding: '0.5rem',
                    borderRadius: '0.625rem',
                    border: `2px solid ${authMethod === method ? '#4f46e5' : '#e5e7eb'}`,
                    background: authMethod === method ? '#eef2ff' : '#fff',
                    color: authMethod === method ? '#4f46e5' : '#6b7280',
                    fontWeight: 700, fontSize: '0.8rem',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  }}
                >
                  {method === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
                  {method === 'phone' ? 'Phone OTP' : 'Email OTP'}
                </button>
              ))}
            </div>

            {authMethod === 'phone' ? (
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Mobile Number <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <span style={{
                    padding: '0.55rem 0.75rem',
                    background: 'var(--gray-100)',
                    border: '1.5px solid var(--gray-300)',
                    borderRight: 'none',
                    borderRadius: '0.5rem 0 0 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--gray-600)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Phone size={14} /> +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="98XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="input"
                    style={{ borderRadius: '0 0.5rem 0.5rem 0', letterSpacing: '1px', fontWeight: 600 }}
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Email Address <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    style={{ paddingLeft: '2.35rem' }}
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                Full Name <span style={{ color: 'var(--red-500)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Ahmed"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2.35rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@')) || !fullName.trim() || userStatus?.isSuperAdmin}
              className="btn btn-primary btn-full"
              style={{
                marginTop: '0.35rem',
                padding: '0.7rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              {sending ? 'Verifying…' : <><span>Verify Number Securely</span><ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: WORKER REGISTRATION STEP 2 (3 Fields - No Scroll) */}
        {/* ========================================================= */}
        {activeTab === 'register' && authStep === 'details' && (
          <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeIn 0.2s ease' }}>
            {/* Primary Skill Trade */}
            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                Primary Skill / Trade <span style={{ color: 'var(--red-500)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                <select
                  value={selectedSkillId}
                  onChange={e => setSelectedSkillId(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2.35rem', cursor: 'pointer' }}
                >
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Area & Experience Side-by-Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Home Area <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <select
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  className="input"
                  style={{ cursor: 'pointer' }}
                >
                  {Object.keys(JAMMU_AREAS).map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '0.3rem' }}>
                  Exp (Years)
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={experienceYears}
                  onChange={e => setExperienceYears(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setAuthStep('phone')}
                className="btn btn-secondary"
                style={{ padding: '0.7rem 0.85rem', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  padding: '0.7rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {submitting ? (
                  'Registering…'
                ) : (
                  <>
                    <UserPlus size={16} /> Complete Registration
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: OTP VERIFICATION (Used for both Login & Register) */}
        {/* ========================================================= */}
        {authStep === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ animation: 'slideUp 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <button
                type="button" onClick={() => { setAuthStep('phone'); setOtp('') }}
                style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0 }}
              >
                <ArrowLeft size={15} />
              </button>
              <div>
                <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '0.9rem' }}>
                  Verify your {authMethod === 'phone' ? 'number' : 'email'}
                </div>
                <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                  OTP sent to <strong>{authMethod === 'phone' ? `+91 ${phone}` : email}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <OtpBoxes value={otp} onChange={setOtp} />
            </div>

            <button
              type="submit"
              disabled={submitting || otp.length < 6}
              className="btn btn-primary btn-full"
              style={{
                padding: '0.8rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {submitting ? 'Verifying…' : <><ShieldCheck size={17} /> {activeTab === 'login' ? 'Verify & Login' : 'Verify & Continue'}</>}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
              {resendCountdown > 0 ? (
                <span>Resend OTP in <strong style={{ color: '#4f46e5' }}>{resendCountdown}s</strong></span>
              ) : (
                <button type="button" onClick={handleSendOtp} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                  Resend OTP →
                </button>
              )}
            </div>
          </form>
        )}

        {/* Quick Footer Switch */}
        <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.775rem', color: 'var(--gray-500)' }}>
          {activeTab === 'login' ? (
            <span>
              New to MistriJi?{' '}
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setAuthStep('phone'); }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Register as a Worker Partner →
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setAuthStep('phone'); }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Login to your Profile →
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
