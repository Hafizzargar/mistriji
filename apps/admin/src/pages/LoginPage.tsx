import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, isConfigured } from '@/lib/supabase'
import { sendOTP, verifyOTP, updatePinWithOTP, verifyPin } from '@/lib/authApi'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Phone, Lock, AlertCircle, Settings, Mail, KeyRound } from 'lucide-react'
import { logAdminAction } from '@/lib/auditLogger'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast    = useToast()
  const { user, setSession } = useAuth()
  
  const rawFrom = location.state?.from
  const targetUrl = typeof rawFrom === 'string' && rawFrom.startsWith('/')
    ? rawFrom
    : (rawFrom?.pathname ? (rawFrom.pathname + (rawFrom.search || '')) : '/dashboard')

  const [step, setStep]             = useState<'phone' | 'otp' | 'pin'>('phone')
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone')
  const [serverError, setError]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [showPin, setShowPin]       = useState(false)
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [pin, setPin]               = useState('')
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [resendCountdown, setResendCountdown] = useState(0)

  // Countdown Timer
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(p => p - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [step, resendCountdown])

  // Reset PIN state
  const [resetPinMode, setResetPinMode]         = useState(false)
  const [newResetPin, setNewResetPin]           = useState('')
  const [confirmResetPin, setConfirmResetPin]   = useState('')
  const [showResetPin, setShowResetPin]         = useState(false)

  const normalizePhone = (value: string) => (value || '').replace(/\D/g, '').slice(-10)

  React.useEffect(() => {
    if (user) {
      navigate(targetUrl, { replace: true })
    }
  }, [user, navigate, targetUrl])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (reason === 'account_deleted') {
      const msg = 'Your administrator account has been deleted by the Super Administrator.'
      setError(msg)
      toast.error(msg)
    } else if (reason === 'account_suspended') {
      const msg = 'Your administrator account has been disabled/suspended by the Super Administrator.'
      setError(msg)
      toast.error(msg)
    } else if (reason === 'account_revoked' || reason === 'session_expired') {
      const msg = 'Your session has expired or your access privileges were modified. Please sign in again.'
      setError(msg)
      toast.error(msg)
    }
  }, [])

  // Step 1: Send OTP
  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError('')

    const identifier = authMethod === 'phone' ? normalizePhone(phone) : email.trim()

    if (authMethod === 'phone') {
      if (!/^[6-9]\d{9}$/.test(identifier)) {
        const msg = 'Enter a valid 10-digit mobile number'
        setError(msg)
        toast.error(msg)
        return
      }
    } else {
      if (!identifier.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        const msg = 'Enter a valid email address'
        setError(msg)
        toast.error(msg)
        return
      }
    }

    setLoading(true)

    // 1. Backend /api/otp/send now verifies that the account exists and is an admin
    // We removed the frontend query to prevent leaking admin JSON payloads in the network tab.

    const result = await sendOTP(identifier, authMethod)
    if (!result.success) {
      console.error('OTP Error:', result.error)
      const msg = result.error || 'Failed to send OTP.'
      setError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    if (result.reused) {
      toast.success('An OTP was already sent recently. Please check your inbox and use that one.')
    } else {
      toast.success(`OTP sent to ${authMethod === 'phone' ? '+91 ' + identifier : identifier}!`)
    }
    if (result.expiresAt) {
      const secondsLeft = Math.floor((result.expiresAt - Date.now()) / 1000)
      setResendCountdown(Math.max(0, secondsLeft))
    } else {
      setResendCountdown(60) // Fallback 1 minute
    }
    setStep('otp')
    setLoading(false)
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const code = otp.join('').trim()
    if (code.length !== 6) {
      const msg = 'Enter all 6 OTP digits'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    setError('')
    const identifier = authMethod === 'phone' ? normalizePhone(phone) : email.trim()
    
    const result = await verifyOTP(identifier, code, authMethod)
    if (!result.success) {
      console.error('Verify Error:', result.error)
      const msg = result.error || 'Invalid or expired OTP. Try again.'
      setError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }
    
    toast.success('Identity verified! Enter your 6-digit PIN.')
    setStep('pin')
    setLoading(false)
  }

  // Step 3: Verify PIN against DB via API
  async function handlePinSubmit(e?: React.FormEvent, overridePin?: string) {
    if (e) e.preventDefault()
    if (loading) return
    const cleanPin = (overridePin || pin).trim()

    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      const msg = 'PIN must be exactly 6 digits'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    setError('')

    const identifier = authMethod === 'phone' ? normalizePhone(phone) : email.trim()
    const code = otp.join('').trim()

    const result = await verifyPin(identifier, code, cleanPin, authMethod)

    if (!result.success || !result.session) {
      console.error('PIN Verify Error:', result.error)
      const msg = result.error || 'Incorrect PIN.'
      setError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    // Set session in React state via AuthContext
    setSession(result.session.access_token, result.session.user)

    logAdminAction({
      actor: result.session.user,
      action: 'Admin Login',
      targetType: 'system',
      targetId: 'auth',
      details: `${result.session.user.role === 'super_admin' ? 'Super Administrator' : 'Administrator'} logged in via ${authMethod.toUpperCase()}`,
    }).catch(err => console.error('Failed to log login action', err))

    toast.success('Welcome back to MistriJi Admin Panel!')
    setLoading(false)
    setTimeout(() => {
      window.location.href = targetUrl
    }, 300)
  }

  function handleOtpInput(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const updated = [...otp]
    updated[index] = value
    setOtp(updated)
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Setup banner — shown when .env is not configured */}
        {!isConfigured && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.625rem',
            padding: '0.875rem 1rem', marginBottom: '1.25rem',
            fontSize: '0.8rem', color: '#92400e', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
              <Settings size={14} /> Setup Required
            </div>
            Copy <code style={{ background: '#fef3c7', padding: '0 4px', borderRadius: 3 }}>apps/admin/.env.example</code> to{' '}
            <code style={{ background: '#fef3c7', padding: '0 4px', borderRadius: 3 }}>apps/admin/.env</code>{' '}
            and fill in your Supabase URL and anon key.
          </div>
        )}

        <div style={styles.header}>
          <div style={styles.logoMark}>🔧</div>
          <h1 style={styles.title}>MistriJi Admin</h1>
          <p style={styles.subtitle}>
            {step === 'phone' && 'Sign in to access your dashboard'}
            {step === 'otp'   && `OTP sent to ${authMethod === 'phone' ? '+91 ' + normalizePhone(phone) : email}`}
            {step === 'pin'   && 'Enter your 6-digit PIN'}
          </p>
        </div>

        {/* Error */}
        {serverError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Step 1: Login Form */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} style={styles.form}>
            {/* Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.25rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
              {(['phone', 'email'] as const).map(method => (
                <button
                  key={method} type="button"
                  onClick={() => { 
                    setAuthMethod(method); 
                    setError('');
                    setPhone('');
                    setEmail('');
                    setOtp(['', '', '', '', '', '']);
                    setPin('');
                  }}
                  style={{
                    padding: '0.625rem', borderRadius: '0.375rem', border: 'none',
                    background: authMethod === method ? '#fff' : 'transparent',
                    color: authMethod === method ? '#4f46e5' : '#6b7280',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: authMethod === method ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
                  }}
                >
                  {method === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
                  {method === 'phone' ? 'Phone OTP' : 'Email OTP'}
                </button>
              ))}
            </div>

            {authMethod === 'phone' ? (
              <div className="input-wrapper">
                <label className="input-label">Mobile Number <span className="required">*</span></label>
                <div style={styles.inputWithPrefix}>
                  <span style={styles.prefix}>+91</span>
                  <input
                    type="tel"
                    className="input"
                    placeholder="60xxxxxxxx"
                    maxLength={10}
                    inputMode="numeric"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ borderLeft: 'none', borderRadius: '0 0.5rem 0.5rem 0', width: '100%' }}
                  />
                </div>
              </div>
            ) : (
              <div className="input-wrapper">
                <label className="input-label">Email Address <span className="required">*</span></label>
                <div style={styles.inputWithIcon}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input
                    type="email"
                    className="input"
                    placeholder="admin@mistriji.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%', height: 42, borderRadius: '0.5rem', border: '1.5px solid #d1d5db', fontSize: '1rem' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || (authMethod === 'email' && !email.includes('@')) || (authMethod === 'phone' && normalizePhone(phone).length < 10)}
              style={{ marginTop: '1.25rem' }}
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Sending OTP…</> : 'Send OTP →'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div className="input-wrapper">
              <label className="input-label">Enter OTP</label>
              <div className="otp-inputs" style={{ justifyContent: 'center', display: 'flex', gap: '0.5rem' }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    className="otp-input"
                    value={digit}
                    maxLength={1}
                    inputMode="numeric"
                    style={{ width: 44, height: 48, textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, border: '1.5px solid #d1d5db', borderRadius: '0.5rem' }}
                    onChange={e => handleOtpInput(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || otp.join('').length < 6}
              style={{ marginTop: '1.25rem' }}
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : 'Verify OTP →'}
            </button>
            <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
              {resendCountdown > 0 ? (
                <span>OTP expires in <strong style={{ color: '#4f46e5' }}>{Math.floor(resendCountdown / 60).toString().padStart(2, '0')}:{(resendCountdown % 60).toString().padStart(2, '0')}</strong></span>
              ) : (
                <span>Didn't receive code? <button type="button" onClick={handleSendOtp} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Resend OTP</button></span>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-full" onClick={() => { setStep('phone'); setError('') }} style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.5rem' }}>
              ← Change {authMethod === 'phone' ? 'number' : 'email'}
            </button>
          </form>
        )}

        {/* Step 3: PIN or Reset PIN */}
        {step === 'pin' && (
          resetPinMode ? (
            <form onSubmit={async (e) => {
              e.preventDefault()
              const cleanNewPin = newResetPin.trim()
              const cleanConfirm = confirmResetPin.trim()
              const identifier = authMethod === 'phone' ? normalizePhone(phone) : email.trim()

              if (cleanNewPin.length !== 6 || !/^\d{6}$/.test(cleanNewPin)) {
                const msg = 'New PIN must be exactly 6 numeric digits'
                setError(msg)
                toast.error(msg)
                return
              }

              if (cleanNewPin !== cleanConfirm) {
                const msg = 'New PIN and Confirm PIN do not match'
                setError(msg)
                toast.error(msg)
                return
              }

              setLoading(true)
              setError('')
              const code = otp.join('').trim()
              const res = await updatePinWithOTP(identifier, code, cleanNewPin, authMethod)
              setLoading(false)

              if (!res.success) {
                setError(res.error || 'Failed to update PIN')
                toast.error(res.error || 'Failed to update PIN')
                return
              }

              toast.success('PIN successfully updated! Signing you in…')
              setPin(cleanNewPin)
              setResetPinMode(false)
              // Execute login with new pin
              handlePinSubmit(e, cleanNewPin)
            }} style={styles.form}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '0.875rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                  <KeyRound size={14} style={{ color: '#4f46e5' }} /> Reset 6-Digit Access PIN
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                  OTP verified for {authMethod === 'phone' ? '+91 ' + normalizePhone(phone) : email}. Enter your new PIN.
                </div>
              </div>

              <div className="input-wrapper" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label" style={{ display: 'block', fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.3rem' }}>
                  New 6-Digit PIN <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={styles.inputWithIcon}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    type={showResetPin ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    value={newResetPin}
                    onChange={e => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%', height: 42, borderRadius: '0.5rem', border: '1.5px solid #d1d5db', fontSize: '1rem', letterSpacing: '2px', fontWeight: 700 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPin(v => !v)}
                    style={styles.eyeBtn}
                  >
                    {showResetPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="input-wrapper" style={{ marginBottom: '1rem' }}>
                <label className="input-label" style={{ display: 'block', fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.3rem' }}>
                  Confirm New PIN <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={styles.inputWithIcon}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    type={showResetPin ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    value={confirmResetPin}
                    onChange={e => setConfirmResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ paddingLeft: '2.5rem', width: '100%', height: 42, borderRadius: '0.5rem', border: '1.5px solid #d1d5db', fontSize: '1rem', letterSpacing: '2px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || newResetPin.length < 6 || confirmResetPin.length < 6}
                style={{ height: 44, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Updating PIN…</> : 'Save New PIN & Log In →'}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => { setResetPinMode(false); setError(''); }}
                style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.5rem', fontSize: '0.8rem' }}
              >
                ← Back to PIN Login
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} style={styles.form}>
              <div className="input-wrapper">
                <label className="input-label" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>6-Digit PIN <span className="required" style={{ color: '#ef4444' }}>*</span></label>
                <div style={styles.inputWithIcon}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    type={showPin ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%', height: 44, borderRadius: '0.5rem', border: '1.5px solid #d1d5db', fontSize: '1rem', letterSpacing: '2px', fontWeight: 700 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(v => !v)}
                    style={styles.eyeBtn}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || pin.length < 6}
                style={{ marginTop: '1.25rem', height: 44, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Logging in…</> : 'Login to Admin →'}
              </button>
              
              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => { setResetPinMode(true); setError(''); }}
                style={{ marginTop: '0.75rem', background: 'transparent', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: '0.4rem', fontSize: '0.825rem', fontWeight: 600 }}
              >
                Forgot or need to change your PIN? Reset with OTP →
              </button>
            </form>
          )
        )}

        {/* Step indicator */}
        <div style={styles.steps}>
          {['phone', 'otp', 'pin'].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                ...styles.stepDot,
                background: step === s ? '#4f46e5' : ['phone','otp','pin'].indexOf(step) > i ? '#16a34a' : '#e5e7eb',
              }} />
              {i < 2 && <div style={styles.stepLine} />}
            </React.Fragment>
          ))}
        </div>
        <p style={styles.stepLabel}>
          Step {['phone','otp','pin'].indexOf(step) + 1} of 3
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--brand-50) 0%, #fff 50%, var(--gray-50) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  card: {
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 40px rgba(99,102,241,0.1), 0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid var(--gray-100)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  logoMark: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--gray-900)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--gray-500)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputWithPrefix: {
    display: 'flex',
    alignItems: 'center',
  },
  prefix: {
    padding: '0.625rem 0.75rem',
    background: 'var(--gray-100)',
    border: '1.5px solid var(--gray-300)',
    borderRight: 'none',
    borderRadius: '0.5rem 0 0 0.5rem',
    fontSize: '0.875rem',
    color: 'var(--gray-700)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  inputWithIcon: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--gray-400)',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'var(--gray-400)',
    cursor: 'pointer',
    display: 'flex',
    padding: 0,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginTop: '1.5rem',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'background 300ms ease',
  },
  stepLine: {
    width: 40,
    height: 2,
    background: '#e5e7eb',
    margin: '0 4px',
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--gray-400)',
    marginTop: '0.5rem',
  },
}
