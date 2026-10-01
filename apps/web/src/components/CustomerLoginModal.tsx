import React, { useState, useEffect, useRef } from 'react'
import { useCustomerAuth, CheckUserStatusResult } from '@/contexts/CustomerAuthContext'
import { useToast } from '@/contexts/ToastContext'
import { sendOTP, verifyOTP as verifyOTPApi } from '@/lib/authApi'
import { X, Phone, User, LogIn, UserPlus, Ban, KeyRound, ArrowLeft, ShieldCheck, HardHat, CheckCircle, Sparkles, Mail } from 'lucide-react'

// ── OTP Box Component ─────────────────────────────────────
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

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
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
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
            width: 44,
            height: 52,
            textAlign: 'center',
            fontSize: '1.4rem',
            fontWeight: 800,
            border: `2px solid ${value[i] ? '#4f46e5' : '#e5e7eb'}`,
            borderRadius: '0.75rem',
            outline: 'none',
            background: value[i] ? '#eef2ff' : '#f9fafb',
            color: '#1e1b4b',
            transition: 'all 0.15s ease',
            boxShadow: value[i] ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────
export function CustomerLoginModal() {
  const { showLoginModal, closeLoginModal, login, checkUserStatus } = useCustomerAuth()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(60)
  const [userStatus, setUserStatus] = useState<CheckUserStatusResult | null>(null)
  // Guard: prevent double OTP verify (React 18 StrictMode runs effects twice in dev)
  const verifyingRef = useRef(false)

  useEffect(() => {
    if (!showLoginModal) {
      setPhone(''); setEmail(''); setName(''); setOtp(''); setStep('phone')
      setUserStatus(null); setActiveTab('login'); setAuthMethod('phone')
      setChecking(false); setLoading(false); setSending(false); setResendCountdown(60)
    }
  }, [showLoginModal])

  useEffect(() => {
    let timer: any
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(p => p - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [step, resendCountdown])

  useEffect(() => {
    if (showLoginModal) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showLoginModal])

  useEffect(() => {
    if (phone.length === 10) {
      setChecking(true)
      checkUserStatus(phone).then(res => {
        setUserStatus(res)
        if (res.exists) {
          if (res.name) setName(res.name)
          setActiveTab('login')
        } else if (!res.isSuperAdmin) {
          setActiveTab('register')
        }
        setChecking(false)
      })
    } else {
      setUserStatus(null)
    }
  }, [phone, checkUserStatus])

  // Auto-verify OTP when 6 digits are entered
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !loading && !verifyingRef.current) {
      handleVerifyOtp()
    }
  }, [otp])

  if (!showLoginModal) return null

  function resetAuthFields(newMethod?: 'phone' | 'email') {
    setPhone('')
    setEmail('')
    setOtp('')
    setUserStatus(null)
    setStep('phone')
    if (newMethod) setAuthMethod(newMethod)
  }

  function handleClose() {
    setPhone(''); setEmail(''); setName(''); setOtp(''); setStep('phone')
    setUserStatus(null); setActiveTab('login'); setAuthMethod('phone')
    setChecking(false); setLoading(false); setSending(false)
    closeLoginModal()
  }

  const isRegistering = activeTab === 'register' || (userStatus && !userStatus.exists && !userStatus.isSuperAdmin)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (userStatus?.isSuperAdmin) { toast.error('This number is associated with a different account type. Please use the correct login portal.'); return }
    if (authMethod === 'phone' && (!phone || phone.length < 10)) { toast.error('Please enter a valid 10-digit mobile number.'); return }
    if (authMethod === 'email' && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { toast.error('Please enter a valid email address.'); return }
    if (userStatus?.isSuspended) { toast.error(`⛔ Account Suspended: ${userStatus.suspensionReason || 'Contact support'}`); return }
    if (isRegistering && !name.trim()) { toast.error('Please enter your full name.'); return }

    setSending(true)
    const identifier = authMethod === 'phone' ? phone : email
    
    // Explicitly check user status to prevent duplicate registration
    if (activeTab === 'register') {
      const statusRes = await checkUserStatus(identifier)
      if (statusRes.exists) {
        toast.error('An account with this email/phone already exists. Please login instead.')
        setSending(false)
        setActiveTab('login')
        return
      }
    }

    const result = await sendOTP(identifier, authMethod)
    setSending(false)

    if (!result.success) {
      toast.error(result.error || 'Error')
      return
    }

    setStep('otp')
    setResendCountdown(60)
    const masked = authMethod === 'phone' ? `+91 ${phone}` : email.replace(/(.{2}).+(@.+)/, '$1***$2')
    toast.success(`📲 OTP sent to ${masked}!`)
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (otp.length < 6) { toast.error('Please enter the 6-digit OTP.'); return }
    if (verifyingRef.current) return   // already running — skip duplicate call
    verifyingRef.current = true
    setLoading(true)

    const identifier = authMethod === 'phone' ? phone : email
    const verifyResult = await verifyOTPApi(identifier, otp, authMethod)
    console.log('[DEBUG] verifyResult:', verifyResult)
    if (!verifyResult.success) {
      setLoading(false)
      verifyingRef.current = false
      toast.error(verifyResult.error || 'Error')
      return
    }

    // OTP verified — log the user in
    const loginPhone = authMethod === 'phone' ? phone : email
    const loginResult = await login(loginPhone, name)
    
    console.log('[DEBUG] loginResult:', loginResult) // Added for debugging

    setLoading(false)
    verifyingRef.current = false
    if (!loginResult.ok) {
      toast.error(loginResult.error)
    } else {
      toast.success(loginResult.isNewUser ? `🎉 Welcome ${name || 'Customer'}! Account created.` : `Welcome back ${name || 'Customer'}!`)
      handleClose()
    }
  }

  const features = [
    { icon: '🛡️', text: 'Verified workers only' },
    { icon: '⚡', text: 'Fast job assignment' },
    { icon: '📞', text: 'Team coordinates for you' },
    { icon: '📋', text: 'Track all your requests' },
  ]

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          borderRadius: '1.5rem',
          overflow: 'hidden',
          maxWidth: 780, width: '100%',
          boxShadow: '0 32px 80px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          animation: 'slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          maxHeight: 'min(92vh, 620px)',
        }}
      >
        {/* ── LEFT PANEL (brand) ────────────────────────── */}
        <div
          className="customer-modal-left-panel"
          style={{
            width: 280, flexShrink: 0,
            background: 'linear-gradient(160deg, #312e81 0%, #1e1b4b 50%, #0f172a 100%)',
            padding: '2.5rem 2rem',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Glow orbs */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
                fontSize: '1.25rem',
              }}>🔧</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>MistriJi</div>
                <div style={{ color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 500, marginTop: '1px' }}>Managed Service</div>
              </div>
            </div>

            <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.3, marginBottom: '0.75rem' }}>
              Your trusted mistri,<br />on demand.
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>
              Submit a request and our team assigns the best verified worker in your area.
            </p>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {features.map(f => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust badge */}
          <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.875rem', padding: '0.75rem 1rem' }}>
            <div style={{ color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Serving</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>Jammu &amp; Kashmir</div>
            <div style={{ color: '#64748b', fontSize: '0.725rem', marginTop: '0.1rem' }}>All districts, verified workers</div>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ────────────────────────── */}
        <div style={{
          flex: 1, background: '#fff',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          position: 'relative',
        }}>
          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: '1.25rem', right: '1.25rem',
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6b7280', transition: 'all 0.15s',
              zIndex: 10,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
          >
            <X size={16} />
          </button>

          <div style={{ padding: '2.5rem 2rem', flex: 1 }}>

            {/* ── PHONE STEP ─────────────────────────────── */}
            {step === 'phone' && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                {/* Tab switcher */}
                <div style={{
                  display: 'inline-flex', background: '#f3f4f6',
                  borderRadius: '0.875rem', padding: '0.25rem',
                  marginBottom: '1.75rem',
                }}>
                  {(['login', 'register'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      style={{
                        border: 'none', cursor: 'pointer',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.625rem',
                        fontSize: '0.825rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        background: activeTab === tab ? '#fff' : 'transparent',
                        color: activeTab === tab ? '#1e1b4b' : '#9ca3af',
                        boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tab === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
                      {tab === 'login' ? 'Login' : 'Register'}
                    </button>
                  ))}
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.35rem' }}>
                  {activeTab === 'login' ? 'Welcome back 👋' : 'Create your account'}
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.55 }}>
                  {activeTab === 'login'
                    ? 'Enter your phone or email to receive a one-time password.'
                    : 'Register to submit service requests and track them in real time.'}
                </p>

                {/* Auth method toggle */}
                <div style={{
                  display: 'flex', gap: '0.5rem', marginBottom: '1.25rem',
                }}>
                  {(['phone', 'email'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => resetAuthFields(method)}
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

                {/* Suspension alert */}
                {userStatus?.isSuspended && (
                  <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#b91c1c', marginBottom: '0.3rem' }}>
                      <Ban size={16} /> Account Suspended
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.5 }}>
                      {userStatus.suspensionReason || 'Contact support to restore your account.'}
                    </div>
                  </div>
                )}

                {/* Existing user found badge */}
                {userStatus?.exists && !userStatus.isSuperAdmin && !userStatus.isSuspended && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', fontWeight: 600, color: '#166534' }}>
                    <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    Account found: <strong>{userStatus.name || 'Registered Customer'}</strong>
                  </div>
                )}

                {/* Admin account badge - Hidden as Generic for Security */}
                {userStatus?.isSuperAdmin && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#166534' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.85rem' }}>
                      <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} /> Account Already Registered
                    </div>
                    <div style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                      This number is associated with a different account type. Please use the correct login portal.
                    </div>
                  </div>
                )}


                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Phone / Email field */}
                  {authMethod === 'phone' ? (
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Mobile Number *
                      </label>
                      <div style={{ display: 'flex', borderRadius: '0.75rem', overflow: 'hidden', border: `2px solid ${phone.length === 10 ? '#4f46e5' : '#e5e7eb'}`, transition: 'border-color 0.15s', background: '#fff' }}>
                        <div style={{ padding: '0.75rem 0.875rem', background: '#f8fafc', borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#374151', fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <Phone size={14} style={{ color: '#4f46e5' }} /> +91
                        </div>
                        <input
                          type="tel" required maxLength={10} inputMode="numeric"
                          placeholder="98XXXXXXXX"
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, letterSpacing: '1px', background: 'transparent', color: '#1e1b4b' }}
                        />
                        {checking && (
                          <div style={{ padding: '0 0.875rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#4f46e5', animation: 'spin 0.6s linear infinite' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Email Address *
                      </label>
                      <div style={{ display: 'flex', borderRadius: '0.75rem', overflow: 'hidden', border: `2px solid ${email.includes('@') ? '#4f46e5' : '#e5e7eb'}`, transition: 'border-color 0.15s', background: '#fff' }}>
                        <div style={{ padding: '0.75rem 0.875rem', background: '#f8fafc', borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
                          <Mail size={15} style={{ color: '#4f46e5' }} />
                        </div>
                        <input
                          type="email" required
                          placeholder="you@example.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 500, background: 'transparent', color: '#1e1b4b' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Name field (registration) */}
                  {isRegistering && !userStatus?.isSuspended && (
                    <div style={{ animation: 'slideUp 0.15s ease' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Full Name *
                      </label>
                      <div style={{ display: 'flex', borderRadius: '0.75rem', overflow: 'hidden', border: '2px solid #e5e7eb', background: '#fff' }}>
                        <div style={{ padding: '0.75rem 0.875rem', background: '#f8fafc', borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
                          <User size={15} style={{ color: '#4f46e5' }} />
                        </div>
                        <input
                          type="text" required placeholder="e.g. Rahul Sharma"
                          value={name} onChange={e => setName(e.target.value)}
                          style={{ flex: 1, border: 'none', outline: 'none', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 500, background: 'transparent', color: '#1e1b4b' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={sending || loading || checking || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@')) || !!userStatus?.isSuperAdmin || !!userStatus?.isSuspended}
                    style={{
                      marginTop: '0.25rem',
                      padding: '0.875rem',
                      borderRadius: '0.875rem',
                      border: 'none',
                      cursor: (userStatus?.isSuspended || userStatus?.isSuperAdmin) ? 'not-allowed' : 'pointer',
                      background: userStatus?.isSuspended
                        ? '#ef4444'
                        : (sending || checking || userStatus?.isSuperAdmin || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@')))
                        ? '#e5e7eb'
                        : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: (sending || checking || userStatus?.isSuperAdmin || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@'))) ? '#9ca3af' : '#fff',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      boxShadow: (sending || checking || userStatus?.isSuperAdmin || (authMethod === 'phone' ? phone.length < 10 : !email.includes('@'))) ? 'none' : '0 4px 16px rgba(79,70,229,0.35)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {sending ? (
                      <>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
                        Sending OTP…
                      </>
                    ) : checking ? (
                      <>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
                        Checking…
                      </>
                    ) : userStatus?.isSuspended ? (
                      <><Ban size={17} /> Account Suspended — Contact Support</>
                    ) : (
                      <><KeyRound size={17} /> {authMethod === 'phone' ? 'Send SMS OTP' : 'Send Email OTP'} →</>
                    )}
                  </button>
                </form>

                {/* Toggle link */}
                <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
                  {activeTab === 'login' ? (
                    <>New here?{' '}
                      <button type="button" onClick={() => setActiveTab('register')} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                        Create an account →
                      </button>
                    </>
                  ) : (
                    <>Already registered?{' '}
                      <button type="button" onClick={() => setActiveTab('login')} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                        Login →
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* ── OTP STEP ───────────────────────────────── */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} style={{ animation: 'slideUp 0.2s ease' }}>
                {/* Back + Phone badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
                  <button
                    type="button" onClick={() => { setStep('phone'); setOtp('') }}
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

                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.35rem' }}>Enter OTP</h3>
                <p style={{ fontSize: '0.825rem', color: '#6b7280', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                  Enter the 6-digit code sent to your {authMethod === 'phone' ? 'mobile number' : 'email inbox'}.
                </p>

                {/* Check spam notice for email */}
                {authMethod === 'email' && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.6rem 0.875rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Mail size={14} style={{ flexShrink: 0 }} /> Check your spam/junk folder if you don't see the email.
                  </div>
                )}

                {/* OTP boxes */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <OtpBoxes value={otp} onChange={setOtp} />
                </div>

                {/* Verify button */}
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  style={{
                    width: '100%',
                    padding: '0.9rem',
                    borderRadius: '0.875rem',
                    border: 'none',
                    cursor: otp.length < 6 ? 'not-allowed' : 'pointer',
                    background: otp.length < 6 ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: otp.length < 6 ? '#9ca3af' : '#fff',
                    fontWeight: 800, fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    boxShadow: otp.length < 6 ? 'none' : '0 4px 16px rgba(79,70,229,0.35)',
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? (
                    <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} /> Verifying…</>
                  ) : (
                    <><ShieldCheck size={17} /> Verify &amp; Continue</>
                  )}
                </button>

                {/* Resend */}
                <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                  {resendCountdown > 0 ? (
                    <span>Resend OTP in <strong style={{ color: '#4f46e5' }}>{resendCountdown}s</strong></span>
                  ) : (
                    <button type="button" onClick={async () => {
                      const identifier = authMethod === 'phone' ? phone : email
                      const result = await sendOTP(identifier, authMethod)
                      if (result.success) {
                        setResendCountdown(60)
                        toast.success('New OTP sent!')
                      } else {
                        toast.error(result.error || 'Error')
                      }
                    }} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                      Resend OTP →
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
