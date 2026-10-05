import React, { useState, useEffect, useRef } from 'react'
import { X, User, Shield, Zap, CalendarClock, Phone as PhoneIcon, CheckCircle, Ban, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCustomerAuth, CheckUserStatusResult } from '@/contexts/CustomerAuthContext'
import { sendOTP, verifyOTP as verifyOTPApi } from '@/lib/authApi'
import { useToast } from '@/contexts/ToastContext'

// ── One-Time Password Input ───────────────────────────────
function OtpInput({ value, onChange, onComplete, disabled }: { value: string, onChange: (val: string) => void, onComplete: () => void, disabled?: boolean }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) return
    const char = val[val.length - 1]
    const newVal = value.split('')
    newVal[index] = char
    const finalVal = newVal.join('').slice(0, 6)
    onChange(finalVal)
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus()
    }
    if (finalVal.length === 6) {
      setTimeout(onComplete, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const newVal = value.split('')
      if (newVal[index]) {
        newVal[index] = ''
        onChange(newVal.join(''))
      } else if (index > 0) {
        newVal[index - 1] = ''
        onChange(newVal.join(''))
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      onChange(pasted)
      if (pasted.length === 6) {
        inputRefs.current[5]?.focus()
        setTimeout(onComplete, 50)
      } else {
        inputRefs.current[pasted.length]?.focus()
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={el => inputRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          disabled={disabled}
          style={{
            width: 44,
            height: 52,
            textAlign: 'center',
            fontSize: '1.4rem',
            fontWeight: 800,
            border: `2px solid ${value[i] ? '#4f46e5' : '#cbd5e1'}`,
            borderRadius: '0.75rem',
            outline: 'none',
            background: value[i] ? 'rgba(79,70,229,0.05)' : '#f8fafc',
            color: '#0f172a',
            transition: 'all 0.15s ease',
            boxShadow: value[i] ? '0 0 0 2px rgba(79,70,229,0.2)' : 'none',
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

  const [step, setStep] = useState<'identifier' | 'otp' | 'register_details'>('identifier')
  const [identifier, setIdentifier] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  
  const [resendCountdown, setResendCountdown] = useState(60)
  const [userStatus, setUserStatus] = useState<CheckUserStatusResult | null>(null)
  const verifyingRef = useRef(false)

  // Derived states
  const authMethod = identifier.includes('@') ? 'email' : 'phone'
  const isEmail = authMethod === 'email'
  
  // Basic validation check
  const isValidIdentifier = isEmail 
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    : identifier.replace(/\D/g, '').length >= 10

  // Reset state on open/close
  useEffect(() => {
    if (!showLoginModal) {
      setIdentifier(''); setName(''); setOtp(''); setStep('identifier')
      setUserStatus(null); setChecking(false); setLoading(false); setSending(false); setResendCountdown(60)
    }
  }, [showLoginModal])

  // Countdown timer for OTP
  useEffect(() => {
    let timer: any
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(p => p - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [step, resendCountdown])

  // Prevent body scroll
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

  // Auto-detect user status
  useEffect(() => {
    if (isValidIdentifier) {
      const cleanIdentifier = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)
      
      setChecking(true)
      checkUserStatus(cleanIdentifier).then(res => {
        setUserStatus(res)
        if (res.exists && res.name) {
          setName(res.name)
        }
        setChecking(false)
      })
    } else {
      setUserStatus(null)
    }
  }, [identifier, isValidIdentifier, checkUserStatus])

  // Auto-verify OTP
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !loading && !verifyingRef.current) {
      handleVerifyOtp()
    }
  }, [otp])

  if (!showLoginModal) return null

  function handleClose() {
    closeLoginModal()
  }

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    
    if (!isValidIdentifier) { toast.error('Please enter a valid phone number or email.'); return }
    if (userStatus?.isSuperAdmin) { toast.error('Administrator accounts must log in via the secure Admin Portal.'); return }
    if (userStatus?.isSuspended) { toast.error(`⛔ Account Suspended: ${userStatus.suspensionReason || 'Contact support'}`); return }
    if (checking || !userStatus) { toast.error('Please wait, verifying account status...'); return }
    
    // If we know they don't exist and we are on the first step, ask for name first
    if (!userStatus.exists && step === 'identifier') {
      toast.error('No account exists with this mobile number. Please register.')
      setStep('register_details')
      return
    }

    if (step === 'register_details' && !name.trim()) { toast.error('Please enter your full name to register.'); return }

    setSending(true)
    const cleanId = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)
    
    const result = await sendOTP(cleanId, authMethod)
    setSending(false)

    if (!result.success) {
      if (result.isSuspended) {
        toast.error('⛔ Your account has been suspended. You cannot log in. Contact support.')
        handleClose()
        return
      }
      toast.error(result.error || 'Failed to send OTP')
      return
    }

    setStep('otp')
    if (result.expiresAt) {
      const secondsLeft = Math.ceil((result.expiresAt - Date.now()) / 1000)
      setResendCountdown(Math.max(0, secondsLeft))
    } else {
      setResendCountdown(300)
    }

    if (result.reused) {
      toast.success('An OTP was already sent recently. Please check your inbox.')
    } else {
      const masked = isEmail ? identifier.replace(/(.{2}).+(@.+)/, '$1***$2') : `+91 ${cleanId}`
      toast.success(`📲 OTP sent to ${masked}!`)
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (otp.length < 6) { toast.error('Please enter the 6-digit OTP.'); return }
    if (verifyingRef.current) return
    
    verifyingRef.current = true
    setLoading(true)

    const cleanId = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)
    const verifyResult = await verifyOTPApi(cleanId, otp, authMethod)
    
    if (!verifyResult.success) {
      setLoading(false)
      verifyingRef.current = false
      if (verifyResult.isSuspended) {
        toast.error('⛔ Your account has been suspended. You cannot log in. Contact support.')
        handleClose()
        return
      }
      toast.error(verifyResult.error || 'Invalid OTP. Please try again.')
      return
    }

    // OTP verified — log the user in
    const loginResult = await login(cleanId, name)
    
    // Add artificial delay for smoother visual feedback before redirect
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    setLoading(false)
    verifyingRef.current = false
    
    if (!loginResult.ok) {
      toast.error(loginResult.error)
    } else {
      toast.success(loginResult.isNewUser ? `🎉 Welcome ${name || 'Customer'}! Account created.` : `Welcome back ${name || 'Customer'}!`)
      handleClose()
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes pulseSoft { 0% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.8; transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-10px) rotate(5deg); } 100% { transform: translateY(0px) rotate(0deg); } }
        
        .cust-modal-wrapper {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 2500; padding: 1rem;
        }

        .cust-modal-box {
          display: flex;
          flex-direction: column;
          border-radius: 1.5rem;
          background: #ffffff;
          color: #0f172a;
          overflow: hidden;
          max-width: 420px; width: 100%;
          max-height: 90vh;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        
        .cust-modal-box * {
          box-sizing: border-box;
        }





        .input-group {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.875rem;
          display: flex;
          align-items: center;
          padding: 0 1.25rem;
          transition: all 0.2s;
        }
        
        .input-group:focus-within {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .styled-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #0f172a;
          padding: 1.25rem 0 1.25rem 1rem;
          font-size: 1.05rem;
          outline: none;
          font-weight: 500;
        }
        
        .styled-input::placeholder {
          color: #64748b;
        }

        .cust-btn-primary {
          width: 100%;
          padding: 1.25rem;
          background: #f97316;
          color: #fff;
          border: none;
          border-radius: 0.875rem;
          font-weight: 700;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px 0 rgba(249, 115, 22, 0.39);
        }
        
        .cust-btn-primary:hover:not(:disabled) {
          background: #ea580c;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
        }
        
        .cust-btn-primary:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 600px) {
          .cust-modal-box { 
            border-radius: 1.5rem 1.5rem 0 0; 
            max-height: 92vh; 
            margin-top: auto;
          }
          .cust-modal-wrapper { 
            align-items: flex-end; 
            padding: 0; 
          }
        }
        
        /* Custom Scrollbar for Modal Content */
        .modal-scroll-content::-webkit-scrollbar {
          width: 6px;
        }
        .modal-scroll-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll-content::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .modal-scroll-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
      
      <div className="cust-modal-wrapper" onClick={handleClose}>
        <div className="cust-modal-box" onClick={e => e.stopPropagation()}>
          
          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              border: 'none', background: 'rgba(0,0,0,0.05)', cursor: 'pointer',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', transition: 'all 0.15s',
              zIndex: 10
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#0f172a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#64748b' }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>

          <div className="modal-scroll-content" style={{ padding: '2rem 1.75rem', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.075em', marginBottom: '0.75rem' }}>
              <User size={14} strokeWidth={2.5} /> CUSTOMER
            </div>
            
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem 0', letterSpacing: '-0.02em' }}>
              Customer Login
            </h2>
            
            {step === 'identifier' && (
              <>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                  Enter your phone number or email and we'll send you a one-time code.
                </p>

                {userStatus?.isSuspended && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.25rem' }}>
                      <Ban size={16} /> Account Suspended
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#f87171' }}>
                      {userStatus.suspensionReason || 'Contact support.'}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendOtp}>
                  <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.875rem' }}>
                    Phone number or email
                  </label>
                  <div className="input-group">
                    <User size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <input 
                      type="text"
                      placeholder="98765 43210 or you@email.com"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      className="styled-input"
                      autoFocus
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="cust-btn-primary" 
                    style={{ marginTop: '2.5rem' }}
                    disabled={sending || checking || userStatus?.isSuspended || !isValidIdentifier}
                  >
                    {sending || checking ? 'Wait...' : 'Send OTP \u2192'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', color: '#94a3b8', fontSize: '0.95rem' }}>
                  New here? <button onClick={() => setStep('register_details')} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem', padding: 0 }}>Create a customer account &rarr;</button>
                </div>
              </>
            )}

            {step === 'register_details' && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                  {identifier ? <>We couldn't find an account for <strong>{identifier}</strong>. </> : 'Welcome to MistriJi! '}Please tell us your details to continue.
                </p>
                <form onSubmit={handleSendOtp}>
                  <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.875rem' }}>
                    Phone number or email
                  </label>
                  <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                    <User size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <input 
                      type="text" 
                      placeholder="e.g. 98765 43210 or you@email.com"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      className="styled-input"
                    />
                  </div>

                  <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.875rem' }}>
                    Full Name
                  </label>
                  <div className="input-group">
                    <User size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <input 
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="styled-input"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="cust-btn-primary" 
                    style={{ marginTop: '2.5rem' }}
                    disabled={sending || checking || !name.trim() || !isValidIdentifier}
                  >
                    {sending || checking ? 'Wait...' : 'Send OTP \u2192'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                   <button onClick={() => setStep('identifier')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
                     Back to Login
                   </button>
                </div>
              </div>
            )}

            {step === 'otp' && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                  We've sent a secure 6-digit code to <strong>{isEmail ? identifier : `+91 ${identifier.replace(/\D/g, '')}`}</strong>.
                </p>

                <form onSubmit={handleVerifyOtp}>
                  <OtpInput 
                    value={otp} 
                    onChange={setOtp} 
                    onComplete={() => {}}
                    disabled={loading}
                  />

                  <button 
                    type="submit" 
                    className="cust-btn-primary" 
                    style={{ marginTop: '1.5rem' }}
                    disabled={loading || otp.length < 6}
                  >
                    {loading ? 'Verifying...' : 'Login Securely \u2192'}
                  </button>
                </form>
                
                <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={resendCountdown > 0 || sending}
                    style={{
                      background: 'none', border: 'none', color: resendCountdown > 0 ? '#64748b' : '#60a5fa',
                      fontSize: '0.95rem', fontWeight: 600, cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
                      padding: 0
                    }}
                  >
                    {resendCountdown > 0 ? `Resend OTP in ${Math.floor(resendCountdown / 60)}:${(resendCountdown % 60).toString().padStart(2, '0')}` : 'Resend OTP'}
                  </button>
                  <button onClick={() => setStep('identifier')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                     Change {isEmail ? 'email' : 'phone number'}
                   </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
