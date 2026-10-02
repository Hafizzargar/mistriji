import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { JAMMU_AREAS, resolveJammuInput, findClosestJammuArea } from '@/lib/jammuCoordinates'
import { fetchSystemAnnouncement, SystemAnnouncement, isServicePaused, fetchOperatingDistricts, PlatformFeatures, fetchPlatformFeatures } from '@/lib/settings'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Navigation, Clock, Phone, LogIn, MapPin, ChevronRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { notifyAdmin, getAdminUrl } from '@/api'

interface Skill { id: string; name: string; icon: string | null; category: string | null }

function shortId(uuid: string) {
  return 'MST-' + uuid.replace(/-/g, '').slice(0, 6).toUpperCase()
}

export function HomePage({ currentArea, onAreaChange }: { currentArea: string; onAreaChange: (a: string) => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { isLoggedIn, customer, openLoginModal } = useCustomerAuth()

  const [skills, setSkills] = useState<Skill[]>([])
  const [allowedDistricts, setAllowedDistricts] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null)
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatures | null>(null)
  const [useGps, setUseGps] = useState(false)
  const [isGpsLoading, setIsGpsLoading] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [showPinSearch, setShowPinSearch] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedJob, setSubmittedJob] = useState<{ id: string } | null>(null)
  const gpsRef = useRef(false)

  useEffect(() => {
    fetchSystemAnnouncement().then(setAnnouncement)
    fetchPlatformFeatures().then(setPlatformFeatures)
    fetchOperatingDistricts().then(list => { const v = list.filter(Boolean); setAllowedDistricts(v.length ? v : []) })
    supabase.from('skills').select('id, name, icon, category').eq('is_active', true).order('sort_order').then(({ data }) => setSkills(data ?? []))
  }, [])

  useEffect(() => {
    if (isLoggedIn && customer) {
      setContactName(prev => prev || customer.name || '')
      setContactPhone(prev => prev || customer.phone || '')
      setAddress(prev => prev || customer.address || '')
    }
  }, [isLoggedIn, customer])

  useEffect(() => {
    if (!gpsRef.current && navigator.geolocation) {
      gpsRef.current = true
      navigator.geolocation.getCurrentPosition(
        pos => {
          const c = findClosestJammuArea(pos.coords.latitude, pos.coords.longitude)
          const district = (JAMMU_AREAS[c.name] as any)?.district || c.name
          fetchOperatingDistricts().then(list => {
            const allowed = list.filter(Boolean)
            if (allowed.length > 0 && !allowed.includes(c.name) && !allowed.includes(district)) return
            onAreaChange(c.name); setUseGps(true)
          })
        },
        () => {}, { timeout: 5000 }
      )
    }
  }, [])

  useEffect(() => {
    if (allowedDistricts.length > 0) {
      const district = (JAMMU_AREAS[currentArea] as any)?.district || currentArea
      if (!allowedDistricts.includes(currentArea) && !allowedDistricts.includes(district)) {
        onAreaChange(allowedDistricts[0])
      }
    }
  }, [allowedDistricts, currentArea])

  const servicePaused = isServicePaused(announcement)
  const selectedSkill = skills.find(s => s.id === selectedSkillId)

  function handleGps() {
    if (!navigator.geolocation) { toast.error('GPS not supported'); return }
    setIsGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = findClosestJammuArea(pos.coords.latitude, pos.coords.longitude)
        const district = (JAMMU_AREAS[c.name] as any)?.district || c.name
        setIsGpsLoading(false)
        if (allowedDistricts.length > 0 && !allowedDistricts.includes(c.name) && !allowedDistricts.includes(district)) {
          toast.error(`GPS found ${c.name}, but we don't operate there yet.`); setUseGps(false); return
        }
        onAreaChange(c.name); setUseGps(true); toast.success(`📍 Location set to ${c.name}`)
      },
      () => { setIsGpsLoading(false); toast.error('Could not detect location.') }
    )
  }

  function handleLocationSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!locationInput.trim()) return
    const r = resolveJammuInput(locationInput)
    const district = (JAMMU_AREAS[r.areaName] as any)?.district || r.areaName
    if (allowedDistricts.length > 0 && !allowedDistricts.includes(r.areaName) && !allowedDistricts.includes(district)) {
      toast.error(`Sorry, we don't operate in ${r.areaName} yet.`); return
    }
    onAreaChange(r.areaName); setUseGps(false); toast.success(`📍 Location: ${r.areaName}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (servicePaused.isPaused) { toast.error(servicePaused.reason || 'Services paused.'); return }
    const clean = contactPhone.replace(/\D/g, '').slice(-10)
    if (clean.length !== 10) { toast.error('Enter a valid 10-digit mobile number.'); return }
    if (!selectedSkillId) { toast.error('Please select a service.'); return }
    if (!isLoggedIn || !customer?.id) { toast.error('You must be logged in to submit a request.'); return }
    setSubmitting(true)
    try {
      const statusToSet = platformFeatures?.assignment_mode === 'manual' ? 'pending_dispatch' : 'requested'
      const payload: any = {
        customer_id: customer.id, skill_id: selectedSkillId, area: currentArea,
        address: address || currentArea, status: statusToSet, price: null,
        contact_name: contactName, contact_phone: clean
      }
      const { data: job, error: jErr } = await supabase.from('jobs').insert(payload).select('id').single()
      if (jErr) throw jErr
      setSubmittedJob(job)
      try {
        await fetch(getAdminUrl('/api/notify/new-job'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id, area: currentArea, skillName: selectedSkill?.name, contactName, contactPhone: clean })
        })
      } catch (_) {}
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setSubmittedJob(null); setStep(1); setSelectedSkillId(''); setAddress(''); setContactName(customer?.name || ''); setContactPhone(customer?.phone || '')
  }

  // ── SUCCESS SCREEN ──────────────────────────────────────
  if (submittedJob) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#1e293b', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(79,70,229,0.2)', border: '2px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem' }}>✅</div>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.35rem', margin: '0 0 0.5rem' }}>Request Submitted!</h2>
          <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '0.5rem', padding: '0.3rem 0.875rem', color: '#a5b4fc', fontWeight: 800, fontSize: '0.95rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>
            {shortId(submittedJob.id)}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.55, margin: '0 0 1rem' }}>
            Our team is finding a verified worker in <strong style={{ color: '#a5b4fc' }}>{currentArea}</strong>.<br />We'll contact you once assigned.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '9999px', padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', marginBottom: '1.5rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            Status: Admin Reviewing
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <button onClick={() => navigate('/my-bookings')} style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', borderRadius: '0.875rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              Track My Request <ChevronRight size={16} />
            </button>
            <button onClick={reset} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.875rem', borderRadius: '0.875rem', cursor: 'pointer' }}>
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN PAGE ───────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .hp-input { width: 100%; height: 50px; padding: 0 1rem; background: #0f172a; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 0.75rem; color: #e2e8f0; font-size: 1rem; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .hp-input:focus { border-color: rgba(129,140,248,0.7); }
        .svc-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.875rem 0.5rem; border: 1.5px solid rgba(255,255,255,0.08); border-radius: 1rem; background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.7); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease; text-align: center; }
        .svc-card:hover { border-color: rgba(129,140,248,0.5); background: rgba(79,70,229,0.12); color: #c7d2fe; }
        .svc-card.sel { border-color: rgba(129,140,248,0.8); background: rgba(79,70,229,0.25); color: #c7d2fe; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        .btn-primary { width: 100%; height: 52px; background: linear-gradient(135deg,#4f46e5,#7c3aed); border: none; border-radius: 0.875rem; color: #fff; font-weight: 800; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(79,70,229,0.4); transition: opacity 0.2s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { width: 100%; height: 50px; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 0.875rem; color: rgba(255,255,255,0.65); font-weight: 700; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; transition: background 0.2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.09); }
        .btn-gps { width: 100%; height: 50px; background: rgba(99,102,241,0.12); border: 1.5px solid rgba(99,102,241,0.3); border-radius: 0.875rem; color: #a5b4fc; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
        .btn-gps.active { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>

        {/* ── HEADER ──────────────────────────────────── */}
        <div style={{ background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              🔧 <span style={{ color: '#818cf8' }}>MistriJi</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', marginTop: 1 }}>Jammu's Trusted Worker Platform</div>
          </div>
          {!isLoggedIn ? (
            <button onClick={openLoginModal} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: '0.625rem', padding: '0.5rem 1rem', color: '#c7d2fe', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LogIn size={14} /> Login
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6ee7b7', fontSize: '0.82rem', fontWeight: 700 }}>
              <CheckCircle size={14} /> {customer?.name?.split(' ')[0] || 'Logged in'}
            </div>
          )}
        </div>

        {/* ── BODY ────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.25rem 2rem' }} className="hide-scrollbar">

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: 0 }}>
            {['Location', 'Service', 'Confirm'].map((label, i) => {
              const n = i + 1; const done = n < step; const active = n === step
              return (
                <React.Fragment key={label}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div className="step-dot" style={{ background: done ? '#4f46e5' : active ? '#4f46e5' : 'rgba(255,255,255,0.06)', border: `2px solid ${active || done ? '#818cf8' : 'rgba(255,255,255,0.12)'}`, color: active || done ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                      {done ? '✓' : n}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: active ? '#c7d2fe' : 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{label}</div>
                  </div>
                  {i < 2 && <div style={{ height: 1, flex: 1, background: done ? '#4f46e5' : 'rgba(255,255,255,0.1)', marginBottom: 18, transition: 'background 0.3s' }} />}
                </React.Fragment>
              )
            })}
          </div>

          {/* Paused banner */}
          {servicePaused.isPaused && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem', color: '#fca5a5', fontWeight: 600 }}>
              <Clock size={15} style={{ flexShrink: 0 }} /> {announcement?.message || 'Services temporarily paused.'}
            </div>
          )}

          {/* ── STEP 1: LOCATION ─────────────────────── */}
          {step === 1 && (
            <div style={{ animation: 'fadeUp 0.2s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.25rem' }}>📍 Where do you need help?</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Select your location in Jammu & Kashmir</div>
              </div>

              {/* GPS */}
              <button type="button" onClick={handleGps} disabled={isGpsLoading} className={`btn-gps ${useGps ? 'active' : ''}`}>
                <Navigation size={17} style={{ animation: isGpsLoading ? 'spin 0.8s linear infinite' : undefined }} />
                {isGpsLoading ? 'Detecting...' : useGps ? `📍 ${currentArea} (GPS)` : 'Use My Location (GPS)'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 700 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* District Grid */}
              {allowedDistricts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem', padding: '0.75rem 0' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#818cf8', animation: 'spin 0.8s linear infinite' }} />
                  Loading areas…
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {allowedDistricts.map(d => {
                    const sel = (allowedDistricts.includes(currentArea) ? currentArea : allowedDistricts[0]) === d
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { onAreaChange(d); setUseGps(false) }}
                        style={{
                          padding: '0.75rem 1rem',
                          background: sel ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${sel ? 'rgba(129,140,248,0.7)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: '0.875rem',
                          color: sel ? '#c7d2fe' : 'rgba(255,255,255,0.6)',
                          fontWeight: sel ? 800 : 600,
                          fontSize: '0.92rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.15s',
                          boxShadow: sel ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>📍</span>
                        <span style={{ lineHeight: 1.25 }}>{d}</span>
                        {sel && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'rgba(129,140,248,0.3)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* PIN search */}
              {!showPinSearch ? (
                <button type="button" onClick={() => setShowPinSearch(true)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  🔍 Search by PIN code or area name
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', animation: 'fadeUp 0.15s ease' }}>
                  <input type="text" className="hp-input" placeholder="PIN code or area name…" value={locationInput} onChange={e => setLocationInput(e.target.value)} autoFocus style={{ flex: 1, height: 46 }} />
                  <button type="button" onClick={handleLocationSearch} style={{ height: 46, padding: '0 1.125rem', background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: '0.75rem', color: '#a5b4fc', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }}>Go</button>
                </div>
              )}

              {!isLoggedIn ? (
                <button type="button" onClick={openLoginModal} style={{ width: '100%', height: 52, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: '0.875rem', color: '#fbbf24', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <LogIn size={17} /> Login / Register to Book
                </button>
              ) : (
                <button type="button" onClick={() => setStep(2)} disabled={allowedDistricts.length === 0} className="btn-primary">
                  Next: Choose Service <ChevronRight size={18} />
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: SERVICE ──────────────────────── */}
          {step === 2 && (
            <div style={{ animation: 'fadeUp 0.2s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.25rem' }}>🔧 What service do you need?</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Tap to select a service</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                {skills.map(skill => (
                  <button key={skill.id} type="button" className={`svc-card${skill.id === selectedSkillId ? ' sel' : ''}`} onClick={() => setSelectedSkillId(skill.id)}>
                    <span style={{ fontSize: '1.75rem', lineHeight: 1 }}><ServiceIcon name={skill.name} icon={skill.icon} category={skill.category} size={26} /></span>
                    <span style={{ lineHeight: 1.25 }}>{skill.name}</span>
                    {skill.id === selectedSkillId && <span style={{ fontSize: '0.6rem', background: 'rgba(129,140,248,0.3)', color: '#a5b4fc', padding: '1px 6px', borderRadius: 99 }}>✓ Selected</span>}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button type="button" onClick={() => setStep(1)} className="btn-secondary" style={{ flex: 1 }}>
                  <ArrowLeft size={15} /> Back
                </button>
                <button type="button" onClick={() => { if (!selectedSkillId) { toast.error('Please select a service.'); return } setStep(3) }} className="btn-primary" style={{ flex: 2 }}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: CONFIRM ──────────────────────── */}
          {step === 3 && (
            <div style={{ animation: 'fadeUp 0.2s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isLoggedIn ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1rem', color: '#fbbf24' }}>
                    <LogIn size={24} style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.375rem' }}>Login Required</div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.85, lineHeight: 1.5 }}>Please verify your mobile number with OTP to submit a request.</div>
                  </div>
                  <button type="button" onClick={openLoginModal} className="btn-primary">Login / Register with OTP <ChevronRight size={16} /></button>
                  <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.875rem', cursor: 'pointer' }}>← Back to Services</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.25rem' }}>📋 Your Contact Details</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>We'll use these to contact you about the booking</div>
                  </div>

                  {/* Summary */}
                  <div style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.875rem', padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '0.85rem', color: '#a5b4fc', fontWeight: 600 }}>
                    <span>📍 {currentArea}</span>
                    {selectedSkill && <span>{selectedSkill.icon || '🔧'} {selectedSkill.name}</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Your Name</label>
                      <input className="hp-input" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Mobile Number *</label>
                      <div style={{ display: 'flex', height: 50, border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', overflow: 'hidden', background: '#0f172a' }}>
                        <div style={{ padding: '0 0.875rem', background: 'rgba(99,102,241,0.15)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#818cf8', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>
                          <Phone size={13} /> +91
                        </div>
                        <input type="tel" inputMode="numeric" maxLength={10} placeholder="98xxxxxxxx" value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, ''))} required style={{ flex: 1, border: 'none', outline: 'none', padding: '0 0.875rem', fontSize: '1rem', fontWeight: 600, background: 'transparent', color: '#e2e8f0' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Address <span style={{ fontWeight: 500, textTransform: 'none', opacity: 0.6 }}>(optional)</span></label>
                      <input className="hp-input" placeholder="House no., lane, landmark…" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    <button type="submit" disabled={submitting || servicePaused.isPaused} className="btn-primary" style={{ height: 54, fontSize: '1rem' }}>
                      {submitting
                        ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} /> Submitting…</>
                        : <>✓ Confirm & Submit Request</>}
                    </button>
                    <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                      <ArrowLeft size={15} /> Back to Services
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────── */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: '1.5rem', flexShrink: 0 }}>
          {[{ icon: '🛡️', text: 'Verified Workers' }, { icon: '⚡', text: 'Fast Response' }, { icon: '📞', text: 'Team Support' }].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              <span>{item.icon}</span><span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default HomePage
