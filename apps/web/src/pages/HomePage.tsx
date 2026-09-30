import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { JAMMU_AREAS, resolveJammuInput, findClosestJammuArea } from '@/lib/jammuCoordinates'
import { fetchSystemAnnouncement, SystemAnnouncement, isServicePaused, fetchOperatingDistricts, PlatformFeatures, fetchPlatformFeatures } from '@/lib/settings'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Navigation, CheckCircle, Clock, Phone, LogIn, MapPin, ChevronRight, ArrowLeft } from 'lucide-react'

import { notifyAdmin, getAdminUrl } from '@/api'

interface Skill { id: string; name: string; icon: string | null; category: string | null }

function shortId(uuid: string) {
  return 'MST-' + uuid.replace(/-/g, '').slice(0, 6).toUpperCase()
}

// ── Step indicator ───────────────────────────────────────
function Steps({ current }: { current: number }) {
  const labels = ['Location', 'Service', 'Contact']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
      {labels.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : active ? 'linear-gradient(135deg,#4f46e5,#818cf8)' : 'rgba(255,255,255,0.08)',
                border: `2px solid ${active ? '#818cf8' : done ? '#4f46e5' : 'rgba(255,255,255,0.15)'}`,
                color: done || active ? '#fff' : 'rgba(255,255,255,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 800,
                boxShadow: active ? '0 0 0 4px rgba(129,140,248,0.25), 0 4px 12px rgba(79,70,229,0.4)' : done ? '0 2px 8px rgba(79,70,229,0.3)' : 'none',
                transition: 'all 0.3s ease',
              }}>{done ? '✓' : n}</div>
              <span style={{ fontSize: '0.6rem', fontWeight: active || done ? 700 : 400, color: active ? '#c7d2fe' : done ? '#a5b4fc' : 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 6px', marginBottom: 16, background: done ? 'linear-gradient(90deg,#4f46e5,#818cf8)' : 'rgba(255,255,255,0.1)', borderRadius: 99, transition: 'background 0.3s ease' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function HomePage({ currentArea, onAreaChange }: { currentArea: string; onAreaChange: (a: string) => void }) {
  const toast = useToast()
  const { isLoggedIn, customer, openLoginModal, openRoleModal } = useCustomerAuth()

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
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null)

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

  // ── AUTO-POP LOGIN MODAL ─────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      const hasSeenModal = sessionStorage.getItem('hasSeenLoginModal')
      if (!hasSeenModal) {
        openLoginModal()
        sessionStorage.setItem('hasSeenLoginModal', 'true')
      }
    }
  }, [isLoggedIn, openLoginModal])

  const gpsRef = React.useRef(false)
  useEffect(() => {
    if (!gpsRef.current && navigator.geolocation) {
      gpsRef.current = true
      navigator.geolocation.getCurrentPosition(
        pos => { 
          const c = findClosestJammuArea(pos.coords.latitude, pos.coords.longitude);
          const district = (JAMMU_AREAS[c.name] as any)?.district || c.name
          
          // Use a local function to check so we don't depend on stale allowedDistricts state
          fetchOperatingDistricts().then(list => {
            const allowed = list.filter(Boolean)
            if (allowed.length > 0 && !allowed.includes(c.name) && !allowed.includes(district)) {
              // Not operating here, do nothing.
              return
            }
            onAreaChange(c.name)
            setUseGps(true)
          })
        },
        () => {}, { timeout: 5000 }
      )
    }
  }, [])

  // Auto-correct currentArea if it's not in allowedDistricts once they load
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
        const c = findClosestJammuArea(pos.coords.latitude, pos.coords.longitude); 
        const district = (JAMMU_AREAS[c.name] as any)?.district || c.name
        setIsGpsLoading(false)
        if (allowedDistricts.length > 0 && !allowedDistricts.includes(c.name) && !allowedDistricts.includes(district)) {
          toast.error(`GPS found ${c.name}, but we don't operate there yet. Please select manually.`)
          setUseGps(false)
          return
        }
        onAreaChange(c.name); 
        setUseGps(true); 
        toast.success(`📍 Location set to ${c.name}`) 
      },
      () => {
        setIsGpsLoading(false)
        toast.error('Could not detect location.')
      }
    )
  }

  function handleLocationSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!locationInput.trim()) return
    const r = resolveJammuInput(locationInput)
    const district = (JAMMU_AREAS[r.areaName] as any)?.district || r.areaName
    if (allowedDistricts.length > 0 && !allowedDistricts.includes(r.areaName) && !allowedDistricts.includes(district)) {
      toast.error(`Sorry, we don't operate in ${r.areaName} yet.`)
      return
    }
    onAreaChange(r.areaName); setUseGps(false)
    toast.success(`📍 Location: ${r.areaName}`)
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
      // Upsert profile in case they added/changed their address during this step
      await supabase.from('profiles').upsert({ user_id: customer.id, name: contactName || 'Customer', area: currentArea, city: JAMMU_AREAS[currentArea]?.region || 'Jammu' }, { onConflict: 'user_id' })
      
      const statusToSet = platformFeatures?.assignment_mode === 'manual' ? 'pending_dispatch' : 'requested'
      
      const payload: any = { customer_id: customer.id, skill_id: selectedSkillId, area: currentArea, address: address || currentArea, status: statusToSet, price: null }
      const { data: job, error: jErr } = await supabase.from('jobs').insert(payload).select('id').single()
      if (jErr) throw jErr
      setSubmittedJob(job)
      // Notify Admin via email (server endpoint)
      const skillName = skills.find(s => s.id === selectedSkillId)?.name || 'Service'
      
      // Determine Admin URL based on current host
      notifyAdmin({
        message: `MistriJi: New booking received! ${skillName} in ${currentArea} by ${contactName || 'Customer'} (${clean}).`,
        link: getAdminUrl('/jobs')
      })
      
      // Notify Admin via in-app notifications
      try {
        await supabase.rpc('notify_admins', {
          p_title: 'New Booking Request',
          p_message: `New booking for ${skillName} in ${currentArea} by ${contactName || 'Customer'}.`,
          p_type: 'booking_alert',
          p_reference_id: job.id
        })
      } catch (notifErr) {
        console.error('Failed to create in-app notifications', notifErr)
      }
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit. Try again.')
    } finally { setSubmitting(false) }
  }

  function reset() {
    setStep(1); setSelectedSkillId(''); setAddress(''); setSubmittedJob(null)
    if (!isLoggedIn) { setContactName(''); setContactPhone('') }
  }

  // ── WORKER REDIRECT ────────────────────────────────────
  if (isLoggedIn && customer?.role === 'worker') {
    return <Navigate to="/worker" replace />
  }

  // ── SUCCESS ────────────────────────────────────────────
  if (submittedJob) {
    return (
      <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', padding: '1.25rem 1rem', position: 'relative', overflowY: 'auto' }}>
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1.75rem', padding: '1.75rem 1.5rem', maxWidth: 440, width: '100%', textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', boxSizing: 'border-box' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 12px 32px rgba(79,70,229,0.5)' }}>
            <CheckCircle size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>Request Submitted!</h2>
          <div style={{ display: 'inline-block', background: 'rgba(79,70,229,0.25)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: '0.625rem', padding: '0.3rem 0.875rem', fontWeight: 800, fontSize: '1rem', color: '#a5b4fc', letterSpacing: '2px', margin: '0.35rem 0 0.875rem' }}>
            {shortId(submittedJob.id)}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '1rem' }}>
            Our team is finding a verified worker in <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{currentArea}</span>.<br />We'll contact you once assigned.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '9999px', padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', marginBottom: '1.25rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
            Status: Admin Reviewing
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <a href="/my-bookings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: '0.875rem', borderRadius: '0.875rem', textDecoration: 'none', boxShadow: '0 8px 24px rgba(79,70,229,0.4)', transition: 'all 0.2s' }}>
              Track My Request <ChevronRight size={15} />
            </a>
            <button onClick={reset} style={{ padding: '0.68rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.825rem', borderRadius: '0.875rem', cursor: 'pointer' }}>
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN LAYOUT ─────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-14px) rotate(3deg); } }
        @keyframes float2 { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-10px) rotate(-3deg); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.7); } }
        @keyframes orb { 0%,100% { transform: scale(1) translate(0,0); } 33% { transform: scale(1.08) translate(20px,-15px); } 66% { transform: scale(-15px,10px); } }
        .service-card:hover { transform: translateY(-2px) scale(1.03); }
        .submit-btn:hover { box-shadow: 0 12px 36px rgba(79,70,229,0.55) !important; transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        .gps-btn:hover { background: rgba(99,102,241,0.25) !important; }
        .glass-input:focus { border-color: rgba(129,140,248,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.2) !important; }
        .back-btn:hover { background: rgba(255,255,255,0.12) !important; }
        .next-btn:hover { box-shadow: 0 8px 28px rgba(79,70,229,0.5) !important; transform: translateY(-1px); }
        .hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @media (max-width: 768px) {
          .homepage-main {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .homepage-left-panel {
            width: 100% !important;
            flex-shrink: 0 !important;
            padding: 0.875rem 1rem !important;
          }
          .homepage-left-panel .how-it-works-list,
          .homepage-left-panel .hero-paragraph,
          .homepage-left-panel .hero-stats {
            display: none !important;
          }
          .homepage-right-panel {
            width: 100% !important;
            flex: 1 !important;
            overflow-y: visible !important;
          }
          .homepage-form-body {
            padding: 1rem !important;
          }
          .homepage-form-header {
            padding: 0.625rem 1rem !important;
          }
          .homepage-bottom-bar {
            padding: 0.5rem 1rem !important;
          }
        }
      `}</style>

      <div className="homepage-main" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ─────────────────────────────────── */}
        <div className="homepage-left-panel hide-scrollbar" style={{
          width: '42%', flexShrink: 0,
          background: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 40%, #0f172a 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '1.25rem 1.75rem',
          position: 'relative', overflowX: 'hidden', overflowY: 'auto',
        }}>
          {/* Animated glow orbs */}
          <div style={{ position: 'absolute', top: '5%', right: '-5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', animation: 'orb 8s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '-8%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, transparent 70%)', animation: 'orb 10s ease-in-out infinite reverse', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '45%', left: '20%', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)', animation: 'orb 12s ease-in-out infinite', pointerEvents: 'none' }} />

          {/* Decorative grid dots */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

          {/* Brand logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '9999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, backdropFilter: 'blur(8px)' }}>🛡️ Managed Service</span>
              <span style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '9999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700 }}>✓ Verified Workers</span>
            </div>

            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(1.25rem, 1.6vw, 1.75rem)', lineHeight: 1.15, marginBottom: '0.375rem', letterSpacing: '-0.03em' }}>
              Book a Trusted<br />
              <span style={{ background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Mistri Across J&K
              </span>
            </h1>

            <p className="hero-paragraph" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', lineHeight: 1.55, marginBottom: '0.875rem', maxWidth: 300 }}>
              Select your service, describe the work — our team assigns the best verified local mistri.
            </p>

            {/* How it works */}
            <div className="how-it-works-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
              {[
                { emoji: '📝', title: 'Submit Request', desc: 'Location, service & description', color: '#818cf8' },
                { emoji: '👨‍💼', title: 'Admin Assigns', desc: 'Best verified worker selected', color: '#c084fc' },
                { emoji: '👷', title: 'Mistri Arrives', desc: 'Worker contacts & visits you', color: '#38bdf8' },
              ].map((item, i) => (
                <div key={item.title} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${item.color}18`, border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, animation: `float${i === 1 ? '2' : ''} ${3.5 + i * 0.7}s ease-in-out infinite` }}>
                    {item.emoji}
                  </div>
                  <div>
                    <div style={{ color: item.color, fontWeight: 700, fontSize: '0.75rem' }}>{item.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', marginTop: 1 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats + region */}
          <div className="hero-stats" style={{ position: 'relative', zIndex: 1, marginTop: '0.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {[
                { val: '500+', label: 'Workers' },
                { val: '20+', label: 'Districts' },
                { val: '4.8★', label: 'Rating' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0.4rem 0.25rem', textAlign: 'center' }}>
                  <div style={{ color: '#c7d2fe', fontWeight: 800, fontSize: '0.82rem', lineHeight: 1 }}>{s.val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.58rem', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.625rem', padding: '0.4rem 0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>📍</div>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.75rem', lineHeight: 1 }}>Serving Jammu &amp; Kashmir</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', marginTop: 2 }}>All districts — verified workers only</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ─────────────────────────────── */}
        <div className="homepage-right-panel" style={{
          flex: 1,
          background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Subtle grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />

          {/* Form header bar */}
          <div className="homepage-form-header" style={{ flexShrink: 0, padding: '0.875rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ color: '#c7d2fe', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1rem' }}>🔧</span> Find a Service
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 2 }}>Fill in the details — our team handles everything</div>
            </div>
            {!isLoggedIn ? (
              <button onClick={openLoginModal} style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(129,140,248,0.35)', borderRadius: '0.625rem', padding: '0.4rem 0.875rem', color: '#c7d2fe', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}>
                <LogIn size={13} /> Login
              </button>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle size={13} /> {customer?.name || 'Logged in'}
              </div>
            )}
          </div>

          {/* Form body */}
          <div className="homepage-form-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem', position: 'relative', zIndex: 1 }}>

            {servicePaused.isPaused && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600 }}>
                <Clock size={14} style={{ flexShrink: 0 }} /> {announcement?.message || 'Services temporarily paused.'}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Steps current={step} />

              {/* ── STEP 1: LOCATION ───────────────────────── */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideUp 0.2s ease' }}>
                  
                  {/* Option 1: GPS */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Option 1: Auto-Detect</label>
                    <button type="button" onClick={handleGps} disabled={isGpsLoading} className="gps-btn" style={{ width: '100%', height: 46, background: useGps ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)', border: `1.5px solid ${useGps ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'}`, borderRadius: '0.75rem', color: useGps ? '#6ee7b7' : '#a5b4fc', fontSize: '0.9rem', fontWeight: 700, cursor: isGpsLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', opacity: isGpsLoading ? 0.7 : 1 }}>
                      <Navigation size={16} className={isGpsLoading ? "spin" : ""} />{isGpsLoading ? 'Detecting Location...' : useGps ? `GPS Verified: ${currentArea} ✓` : 'Use My Current Location (GPS)'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>OR</div>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                  </div>

                  {/* Option 2: Manual */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Option 2: Select Manually</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ position: 'relative' }}>
                        <MapPin size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#818cf8', pointerEvents: 'none' }} />
                        <select
                          className="glass-input"
                          value={allowedDistricts.includes(currentArea) ? currentArea : (allowedDistricts[0] || '')}
                          onChange={e => { onAreaChange(e.target.value); setUseGps(false) }}
                          style={{ width: '100%', paddingLeft: '2.4rem', fontWeight: 600, fontSize: '0.9rem', height: 46, background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '0.75rem', color: '#e2e8f0', outline: 'none', cursor: 'pointer', transition: 'all 0.2s', appearance: 'none' }}
                        >
                          {allowedDistricts.length === 0
                            ? <option value="" disabled>Loading…</option>
                            : allowedDistricts.map(d => <option key={d} value={d} style={{ background: '#1e1b4b' }}>{d}</option>)
                          }
                        </select>
                        <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.4)' }}>▼</div>
                      </div>

                      {!showPinSearch ? (
                        <button type="button" onClick={() => setShowPinSearch(true)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '0.25rem 0', alignSelf: 'flex-start' }}>
                          + Search by PIN code / specific area
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', animation: 'slideUp 0.15s ease' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <MapPin size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
                            <input type="text" className="glass-input" placeholder="Type PIN code / area name…" value={locationInput} onChange={e => setLocationInput(e.target.value)} autoFocus
                              style={{ width: '100%', height: 42, paddingLeft: '2.1rem', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }}
                            />
                          </div>
                          <button type="button" onClick={handleLocationSearch} style={{ height: 42, padding: '0 1rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '0.75rem', color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
                            Locate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isLoggedIn ? (
                    <button type="button" onClick={openLoginModal}
                      className="next-btn" style={{ height: 46, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.875rem', color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', marginTop: '0.25rem' }}>
                      <LogIn size={16} /> Please register or login
                    </button>
                  ) : (
                    <button type="button" onClick={() => setStep(2)} 
                      disabled={allowedDistricts.length === 0 || (!allowedDistricts.includes(currentArea) && !allowedDistricts.includes((JAMMU_AREAS[currentArea] as any)?.district || ''))} 
                      className="next-btn" style={{ height: 46, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: '0.875rem', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(79,70,229,0.4)', transition: 'all 0.2s', marginTop: '0.25rem' }}>
                      Next: Choose Service <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP 2: SERVICE ─────────────────────────── */}
              {step === 2 && (
                <div style={{ animation: 'slideUp 0.2s ease' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    {skills.map(skill => {
                      const sel = skill.id === selectedSkillId
                      const hov = hoveredSkill === skill.id
                      return (
                        <button key={skill.id} type="button"
                          className="service-card"
                          onClick={() => setSelectedSkillId(skill.id)}
                          onMouseEnter={() => setHoveredSkill(skill.id)}
                          onMouseLeave={() => setHoveredSkill(null)}
                          style={{
                            padding: '0.625rem 0.4rem',
                            border: `1.5px solid ${sel ? 'rgba(129,140,248,0.7)' : hov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '0.875rem',
                            background: sel ? 'rgba(79,70,229,0.35)' : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                            color: sel ? '#c7d2fe' : 'rgba(255,255,255,0.65)',
                            fontWeight: sel ? 700 : 500,
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                            fontSize: '0.74rem',
                            transition: 'all 0.18s ease',
                            boxShadow: sel ? '0 0 0 3px rgba(99,102,241,0.25), 0 4px 16px rgba(79,70,229,0.3)' : 'none',
                          }}>
                          <span style={{ fontSize: '1.5rem' }}><ServiceIcon name={skill.name} icon={skill.icon} category={skill.category} size={22} /></span>
                          <span style={{ textAlign: 'center', lineHeight: 1.25 }}>{skill.name}</span>
                          {sel && <span style={{ fontSize: '0.6rem', background: 'rgba(129,140,248,0.3)', color: '#a5b4fc', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>✓ Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setStep(1)} className="back-btn" style={{ flex: 1, height: 42, background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.875rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', transition: 'all 0.2s' }}>
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button type="button" onClick={() => { if (!selectedSkillId) { toast.error('Pick a service.'); return } setStep(3) }} className="next-btn" style={{ flex: 2, height: 42, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: '0.875rem', color: '#fff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(79,70,229,0.4)', transition: 'all 0.2s' }}>
                      Next: Your Contact <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: CONTACT ─────────────────────────── */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slideUp 0.2s ease' }}>
                  {!isLoggedIn ? (
                    <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                      <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem', color: '#fbbf24', fontSize: '0.85rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <LogIn size={16} /> Verification Required
                        </h4>
                        <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4 }}>
                          To prevent spam and ensure safety, please verify your mobile number with OTP to raise a request.
                        </p>
                      </div>
                      <button type="button" onClick={openLoginModal} style={{ width: '100%', height: 48, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: '0.875rem', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(79,70,229,0.4)', transition: 'all 0.2s' }}>
                        Login / Register with OTP <ChevronRight size={16} />
                      </button>
                      <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600, marginTop: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                        ← Back to Services
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Name</label>
                          <input className="glass-input" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} required={!isLoggedIn} readOnly={isLoggedIn}
                            style={{ width: '100%', height: 42, padding: '0 0.875rem', background: 'rgba(255,255,255,0.02)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile *</label>
                          <div style={{ display: 'flex', height: 42, border: `1.5px solid rgba(255,255,255,0.1)`, borderRadius: '0.75rem', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                            <div style={{ padding: '0 0.625rem', background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#818cf8', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                              <Phone size={12} />+91
                            </div>
                            <input type="tel" inputMode="numeric" maxLength={10} placeholder="98xxxxxxxx" value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, ''))} required readOnly={isLoggedIn}
                              style={{ flex: 1, border: 'none', outline: 'none', padding: '0 0.625rem', fontSize: '0.875rem', fontWeight: 600, background: 'transparent', color: 'rgba(255,255,255,0.5)' }}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address (optional)</label>
                        <input className="glass-input" placeholder="House no., lane, landmark…" value={address} onChange={e => setAddress(e.target.value)}
                          style={{ width: '100%', height: 42, padding: '0 0.875rem', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#e2e8f0', fontSize: '0.875rem', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* Summary pill */}
                      <div style={{ background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '0.75rem', padding: '0.5rem 0.875rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1rem', fontSize: '0.77rem', color: '#a5b4fc', marginTop: '0.25rem' }}>
                        <span>📍 {currentArea}</span>
                        {selectedSkill && <span>{selectedSkill.icon || '🔧'} {selectedSkill.name}</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button type="button" onClick={() => setStep(2)} className="back-btn" style={{ flex: 1, height: 44, background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '0.875rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', transition: 'all 0.2s' }}>
                          <ArrowLeft size={14} /> Back
                        </button>
                        <button type="submit" disabled={submitting || servicePaused.isPaused} className="submit-btn" style={{ flex: 2, height: 44, background: submitting ? 'rgba(79,70,229,0.5)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: '0.875rem', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 8px 24px rgba(79,70,229,0.45)', transition: 'all 0.2s' }}>
                          {submitting
                            ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} /> Submitting…</>
                            : <>✓ Confirm & Submit Request</>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Bottom bar */}
          <div className="homepage-bottom-bar" style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.5rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
            {[{ icon: '🛡️', text: 'Verified workers' }, { icon: '⚡', text: 'Fast response' }, { icon: '📞', text: 'Team support' }].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                <span>{item.icon}</span><span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default HomePage
