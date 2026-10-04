import React, { useState, useEffect, useRef } from 'react'
import { X, HardHat, Ban, User, Phone, CheckCircle, ChevronDown, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { sendOTP, verifyOTP as verifyOTPApi } from '@/lib/authApi'
import { useToast } from '@/contexts/ToastContext'

const JAMMU_AREAS = [
  'Gandhi Nagar', 'Trikuta Nagar', 'Channi Himmat', 'Sainik Colony',
  'Bari Brahmana', 'Satwari', 'Janipur', 'Bantalab', 'Roop Nagar',
  'Sidhra', 'Talab Tillo', 'Bahu Fort', 'Bishnah', 'R.S. Pura', 'Akhnoor'
]

function getCoordinatesForArea(area: string): { lat: number, lng: number } {
  const coords: Record<string, { lat: number, lng: number }> = {
    'Gandhi Nagar': { lat: 32.7051, lng: 74.8687 },
    'Trikuta Nagar': { lat: 32.7013, lng: 74.8878 },
    'Channi Himmat': { lat: 32.6953, lng: 74.8973 },
    'Sainik Colony': { lat: 32.6841, lng: 74.9082 },
    'Bari Brahmana': { lat: 32.6288, lng: 74.9221 },
    'Satwari': { lat: 32.6934, lng: 74.8471 },
    'Janipur': { lat: 32.7562, lng: 74.8415 },
    'Bantalab': { lat: 32.7845, lng: 74.8329 },
    'Roop Nagar': { lat: 32.7672, lng: 74.8354 },
    'Sidhra': { lat: 32.7533, lng: 74.8931 },
    'Talab Tillo': { lat: 32.7301, lng: 74.8375 },
    'Bahu Fort': { lat: 32.7169, lng: 74.8812 },
    'Bishnah': { lat: 32.6152, lng: 74.8623 },
    'R.S. Pura': { lat: 32.6074, lng: 74.7335 },
    'Akhnoor': { lat: 32.8804, lng: 74.7381 },
  }
  return coords[area] || { lat: 32.7266, lng: 74.8570 } 
}

function resolveJammuInput(inputStr: string): string {
  const normalized = inputStr.trim().toLowerCase()
  const matched = JAMMU_AREAS.find(a => a.toLowerCase() === normalized)
  return matched || 'Jammu'
}

function OtpInput({ value, onChange, onComplete, disabled }: { value: string, onChange: (val: string) => void, onComplete: () => void, disabled?: boolean }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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
          onKeyDown={e => handleKey(i, e)}
          onChange={e => handleChange(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          disabled={disabled}
          style={{
            width: 44,
            height: 52,
            textAlign: 'center',
            fontSize: '1.4rem',
            fontWeight: 800,
            border: `2px solid ${value[i] ? '#2563eb' : '#cbd5e1'}`,
            borderRadius: '0.75rem',
            outline: 'none',
            background: value[i] ? 'rgba(37, 99, 235, 0.05)' : '#f8fafc',
            color: '#0f172a',
            transition: 'all 0.15s ease',
            boxShadow: value[i] ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
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

export function WorkerAuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { login } = useCustomerAuth()
  const toast = useToast()
  
  const [skills, setSkills] = useState<SkillOption[]>([])
  
  const [step, setStep] = useState<'identifier' | 'register_details' | 'otp'>('identifier')
  const [identifier, setIdentifier] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [area, setArea] = useState('Gandhi Nagar')
  const [experienceYears, setExperienceYears] = useState('5')
  
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  const authMethod = identifier.includes('@') ? 'email' : 'phone'
  const isEmail = authMethod === 'email'
  
  const isValidIdentifier = isEmail 
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    : identifier.replace(/\D/g, '').length >= 10

  useEffect(() => {
    const handleOpenRegister = (e: any) => {
      setStep(e.detail?.openLogin ? 'identifier' : 'identifier')
      if (e.detail?.phone) {
        setIdentifier(e.detail.phone)
      }
    }
    window.addEventListener('open-worker-register', handleOpenRegister)
    return () => window.removeEventListener('open-worker-register', handleOpenRegister)
  }, [])

  useEffect(() => {
    let timer: any
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(p => p - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [step, resendCountdown])

  useEffect(() => {
    if (!isOpen) {
      setIdentifier('')
      setOtp('')
      setFullName('')
      if (skills.length > 0) setSelectedSkillId(skills[0].id)
      setArea('Gandhi Nagar')
      setExperienceYears('5')
      setUserStatus(null)
      setStep('identifier')
      setChecking(false)
      setSubmitting(false)
      setSending(false)
    }
  }, [isOpen, skills])

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen])

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

  useEffect(() => {
    if (isValidIdentifier) {
      const cleanIdentifier = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)
      
      setChecking(true)
      let query = supabase
        .from('users')
        .select('id, phone, email, role, status, profiles (name, area, photo_url)')
        
      if (isEmail) {
        query = query.eq('email', cleanIdentifier)
      } else {
        query = query.or(`phone.eq.${cleanIdentifier},phone.eq.+91${cleanIdentifier},phone.ilike.%${cleanIdentifier}%`)
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
  }, [identifier, isValidIdentifier])

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    
    if (!isValidIdentifier) { toast.error('Please enter a valid phone number or email.'); return }
    if (userStatus?.isSuperAdmin) { toast.error('Administrator accounts must log in via the secure Admin Portal.'); return }
    if (userStatus?.isSuspended) { toast.error(`⛔ Account Suspended: ${userStatus.suspensionReason || 'Contact support'}`); return }
    if (checking || !userStatus) { toast.error('Please wait, verifying account status...'); return }
    
    if (!userStatus.exists && step === 'identifier') {
      setStep('register_details')
      return
    }

    if (step === 'register_details' && !fullName.trim()) { toast.error('Please enter your full name.'); return }

    setSending(true)
    const cleanId = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)
    const result = await sendOTP(cleanId, authMethod)
    
    if (!result.success) {
      if (result.isSuspended) {
        toast.error('⛔ Your account has been suspended. You cannot log in. Contact support.')
        onClose()
        return
      }
      toast.error(result.error || 'Failed to send OTP')
      setSending(false)
      return
    }

    if (result.reused) {
      toast.success('An OTP was already sent recently. Please check your inbox.')
    } else {
      const masked = isEmail ? identifier.replace(/(.{2}).+(@.+)/, '$1***$2') : `+91 ${cleanId}`
      toast.success(`📲 OTP sent to ${masked}!`)
    }

    setStep('otp')
    if (result.expiresAt) {
      const secondsLeft = Math.ceil((result.expiresAt - Date.now()) / 1000)
      setResendCountdown(Math.max(0, secondsLeft))
    } else {
      setResendCountdown(300)
    }
    setSending(false)
  }

  async function handleFinalSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (otp.length < 6) { toast.error('Please enter the 6-digit OTP.'); return }
    if (userStatus?.isSuperAdmin) {
      toast.error('Administrator accounts must log in via the secure Admin Portal.')
      return
    }

    setSubmitting(true)
    const cleanId = isEmail ? identifier : identifier.replace(/\D/g, '').slice(-10)

    try {
      const verifyResult = await verifyOTPApi(cleanId, otp, authMethod)
      if (!verifyResult.success) {
        if (verifyResult.isSuspended) {
          toast.error('⛔ Your account has been suspended. You cannot log in. Contact support.')
          onClose()
          return
        }
        toast.error(verifyResult.error || 'Invalid OTP. Please try again.')
        setSubmitting(false)
        return
      }

      let query = supabase.from('users').select('id, role, status, profiles(photo_url)')
      if (isEmail) {
        query = query.eq('email', cleanId)
      } else {
        query = query.or(`phone.eq.${cleanId},phone.eq.+91${cleanId}`)
      }
      
      const { data: usersList, error: usersQueryErr } = await query
      // Fail-closed: if DB query fails, block login
      if (usersQueryErr) {
        toast.error('Unable to verify account status. Please try again.')
        setSubmitting(false)
        return
      }
      const existingUser = (usersList as any)?.find((u: any) => u.role === 'super_admin' || u.role === 'admin') || (usersList as any)?.[0]

      if (existingUser && (existingUser.role === 'super_admin' || existingUser.role === 'admin')) {
        toast.error('⛔ Administrator account detected. Please use the Admin portal.')
        setSubmitting(false)
        return
      }

      const BLOCKED_STATUSES = new Set(['suspended', 'disabled', 'deactivated'])
      if (existingUser && BLOCKED_STATUSES.has((existingUser.status || '').toLowerCase())) {
        const photo = (existingUser.profiles as any)?.photo_url
        const reason = photo && photo.startsWith('suspension_reason:') ? photo.replace('suspension_reason:', '') : 'Suspended'
        toast.error(`⛔ Worker account suspended. Reason: "${reason}".`)
        setSubmitting(false)
        return
      }

      const coords = getCoordinatesForArea(area)
      let workerId = existingUser?.id

      if (!workerId) {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .insert({
            phone: isEmail ? String(Math.floor(1000000000 + Math.random() * 9000000000)) : cleanId,
            role: 'worker',
            status: 'active',
            email: isEmail ? cleanId : 'hafezzargar987+wo@gmail.com'
          })
          .select('id')
          .single()

        if (userErr) throw userErr
        workerId = userData.id
      } else {
        if (existingUser.role === 'customer') {
          const { error: updateErr } = await supabase
            .from('users')
            .update({ role: 'worker', email: isEmail ? cleanId : (existingUser.email || 'hafezzargar987+wo@gmail.com') })
            .eq('id', workerId)
          if (updateErr) throw updateErr
        } else {
          if (!existingUser.email || isEmail) {
            await supabase.from('users').update({ email: isEmail ? cleanId : 'hafezzargar987+wo@gmail.com' }).eq('id', workerId)
          }
        }
      }

      if (!userStatus?.exists) {
        const { error: profErr } = await supabase.from('profiles').upsert(
          { user_id: workerId, name: fullName.trim() || 'Mistri Partner', area: area, city: 'Jammu', lat: coords.lat, lng: coords.lng },
          { onConflict: 'user_id' }
        )
        if (profErr) throw profErr

        const { error: wpErr } = await supabase.from('worker_profiles').upsert(
          { user_id: workerId, experience_years: parseInt(experienceYears, 10) || 3, is_available: true, verification_status: 'verified', phone_type: 'smartphone' },
          { onConflict: 'user_id' }
        )
        if (wpErr) throw wpErr
      }

      if (selectedSkillId && !userStatus?.exists) {
        await supabase.from('worker_skills').delete().eq('worker_id', workerId)
        await supabase.from('worker_skills').insert({ worker_id: workerId, skill_id: selectedSkillId })
      }

      toast.success(
        !userStatus?.exists
          ? `🎉 Welcome ${fullName || 'Partner'}! Your worker profile is registered.`
          : `✅ Welcome back! Logged into your worker profile successfully.`
      )
      
      const loginResult = await login(isEmail ? cleanId : (cleanId || ''), fullName)
      
      // Add artificial delay for smoother visual feedback before redirect
      await new Promise(resolve => setTimeout(resolve, 800))
      
      if (!loginResult.ok) {
        toast.error(loginResult.error || 'Authentication failed.')
        setSubmitting(false)
        return
      }

      window.location.href = '/worker/dashboard'
    } catch (err: any) {
      console.error('Worker auth error:', err)
      toast.error(err.message || 'Authentication failed. Please try again.')
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-10px) rotate(5deg); } 100% { transform: translateY(0px) rotate(0deg); } }
        
        .worker-modal-wrapper {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 2500; padding: 1rem;
        }

        .worker-modal-box {
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
        
        .worker-modal-box * {
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

        .worker-btn-primary {
          width: 100%;
          padding: 1.25rem;
          background: #2563eb;
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
          box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.39);
        }
        
        .worker-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
        }
        
        .worker-btn-primary:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .styled-select {
          flex: 1;
          background: transparent;
          border: none;
          color: #0f172a;
          padding: 1.25rem 0 1.25rem 1rem;
          font-size: 1.05rem;
          outline: none;
          font-weight: 500;
          appearance: none;
        }
        .styled-select option {
          background: #ffffff;
          color: #0f172a;
        }

        .grid-2-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 600px) {
          .grid-2-col {
            grid-template-columns: 1fr;
          }
          .worker-modal-box { 
            border-radius: 1.5rem 1.5rem 0 0; 
            max-height: 92vh; 
            margin-top: auto;
          }
          .worker-modal-wrapper { 
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
      
      <div className="worker-modal-wrapper" onClick={onClose}>
        <div className="worker-modal-box" onClick={e => e.stopPropagation()}>
          
          {/* Close button */}
          <button
            onClick={onClose}
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
              <HardHat size={14} strokeWidth={2.5} /> MISTRI & ARTISAN PARTNER
            </div>
            
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem 0', letterSpacing: '-0.02em' }}>
              Worker Login
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
                    className="worker-btn-primary" 
                    style={{ marginTop: '2.5rem' }}
                    disabled={sending || checking || userStatus?.isSuspended || !isValidIdentifier}
                  >
                    {sending || checking ? 'Wait...' : 'Send OTP \u2192'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', color: '#94a3b8', fontSize: '0.95rem' }}>
                  New to MistriJi? <button onClick={() => setStep('register_details')} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem', padding: 0 }}>Register as a Worker Partner &rarr;</button>
                </div>
              </>
            )}

            {step === 'register_details' && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                  Join our partner network. Please fill out your professional details below.
                </p>
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                      Phone number or email
                    </label>
                    <div className="input-group">
                      <User size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                      <input 
                        type="text" required
                        placeholder="98765 43210 or you@email.com"
                        value={identifier} onChange={e => setIdentifier(e.target.value)}
                        className="styled-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                      Full Name
                    </label>
                    <div className="input-group">
                      <User size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                      <input 
                        type="text" required
                        placeholder="e.g. Tariq Ahmed"
                        value={fullName} onChange={e => setFullName(e.target.value)}
                        className="styled-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                      Primary Trade / Skill
                    </label>
                    <div className="input-group">
                      <HardHat size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                      <select required value={selectedSkillId} onChange={e => setSelectedSkillId(e.target.value)} className="styled-select">
                        {skills.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                      </select>
                      <ChevronDown size={16} style={{ color: '#94a3b8' }} />
                    </div>
                  </div>

                  <div className="grid-2-col">
                    <div>
                      <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                        Base Area
                      </label>
                      <div className="input-group">
                        <select required value={area} onChange={e => setArea(e.target.value)} className="styled-select" style={{ paddingLeft: '0.5rem' }}>
                          <option value="" disabled>Select Area</option>
                          {JAMMU_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                        Experience
                      </label>
                      <div className="input-group">
                        <select required value={experienceYears} onChange={e => setExperienceYears(e.target.value)} className="styled-select" style={{ paddingLeft: '0.5rem' }}>
                          <option value="" disabled>Years</option>
                          {[1,2,3,4,5,6,7,8,9,10,15,20].map(y => <option key={y} value={y}>{y}+ Years</option>)}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b' }} />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="worker-btn-primary" 
                    style={{ marginTop: '1.5rem' }}
                    disabled={sending || checking || !fullName.trim() || !selectedSkillId || !isValidIdentifier}
                  >
                    {sending || checking ? 'Wait...' : 'Continue to Verification \u2192'}
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

                <form onSubmit={handleFinalSubmit}>
                  <OtpInput 
                    value={otp} 
                    onChange={setOtp} 
                    onComplete={handleFinalSubmit}
                    disabled={submitting}
                  />

                  <button 
                    type="submit" 
                    className="worker-btn-primary" 
                    style={{ marginTop: '1.5rem' }}
                    disabled={submitting || otp.length < 6}
                  >
                    {submitting ? 'Verifying...' : 'Login Securely \u2192'}
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
