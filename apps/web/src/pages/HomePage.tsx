import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { JAMMU_AREAS, resolveJammuInput, findClosestJammuArea } from '@/lib/jammuCoordinates'
import { fetchSystemAnnouncement, SystemAnnouncement, isServicePaused, fetchOperatingDistricts, PlatformFeatures, fetchPlatformFeatures } from '@/lib/settings'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Navigation, Clock, Phone, LogIn, MapPin, ChevronRight, ArrowLeft, CheckCircle, ChevronDown, ShieldCheck, Zap, Users, Star } from 'lucide-react'
import { getAdminUrl } from '@/api'

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
  const [districtOpen, setDistrictOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedJob, setSubmittedJob] = useState<{ id: string } | null>(null)
  const gpsRef = useRef(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDistrictOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const servicePaused = isServicePaused(announcement)
  const selectedSkill = skills.find(s => s.id === selectedSkillId)
  const selectedDistrict = allowedDistricts.includes(currentArea) ? currentArea : (allowedDistricts[0] || '')

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
    onAreaChange(r.areaName); setUseGps(false); setShowPinSearch(false)
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
    setSubmittedJob(null); setStep(1); setSelectedSkillId(''); setAddress('')
    setContactName(customer?.name || ''); setContactPhone(customer?.phone || '')
  }

  // ── SUCCESS SCREEN ──────────────────────────────────────
  if (submittedJob) {
    return (
      <div className="hp-page">
        <div className="hp-card" style={{ textAlign: 'center' }}>
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
            <button onClick={() => navigate('/my-bookings')} className="hp-btn-primary">
              Track My Request <ChevronRight size={16} />
            </button>
            <button onClick={reset} className="hp-btn-secondary">Submit Another Request</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dropIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

        * { box-sizing: border-box; }

        .hp-page {
          min-height: 100dvh;
          background: #0d1117;
          background-image: url('/hero-bg.jpg');
          background-size: cover;
          background-position: center right;
          background-attachment: fixed;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .hp-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, rgba(10,10,30,0.88) 0%, rgba(13,17,40,0.7) 50%, rgba(10,10,30,0.82) 100%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── NAVBAR ── */
        .hp-nav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.875rem 2rem;
          background: rgba(10,10,30,0.6);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .hp-nav-logo { display:flex; align-items:center; gap:0.6rem; color:#fff; font-weight:900; font-size:1.25rem; text-decoration:none; }
        .hp-nav-logo-icon { width:36px; height:36px; background:linear-gradient(135deg,#4f46e5,#7c3aed); border-radius:0.625rem; display:flex; align-items:center; justify-content:center; font-size:1.1rem; }
        .hp-nav-links { display:flex; align-items:center; gap:1.75rem; }
        .hp-nav-link { color:rgba(255,255,255,0.6); font-size:0.875rem; font-weight:500; text-decoration:none; transition:color 0.2s; cursor:pointer; background:none; border:none; }
        .hp-nav-link:hover { color:#fff; }
        .hp-nav-actions { display:flex; align-items:center; gap:0.625rem; }
        .hp-nav-login { padding:0.5rem 1.125rem; background:transparent; border:1.5px solid rgba(255,255,255,0.25); border-radius:0.625rem; color:#fff; font-size:0.875rem; font-weight:700; cursor:pointer; transition:all 0.2s; }
        .hp-nav-login:hover { border-color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.05); }
        .hp-nav-signup { padding:0.5rem 1.125rem; background:linear-gradient(135deg,#4f46e5,#7c3aed); border:none; border-radius:0.625rem; color:#fff; font-size:0.875rem; font-weight:700; cursor:pointer; transition:opacity 0.2s; }
        .hp-nav-signup:hover { opacity:0.9; }

        /* ── MAIN BODY ── */
        .hp-body {
          position: relative; z-index: 1;
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 1.5rem 2rem 1.5rem 3rem;
          gap: 2rem;
          overflow-y: auto;
          min-height: 0;
        }

        /* ── FORM CARD ── */
        .hp-card {
          background: rgba(15,20,50,0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 1.5rem;
          padding: 1.5rem;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
          flex-shrink: 0;
          overflow-y: auto;
          max-height: calc(100dvh - 120px);
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hp-card::-webkit-scrollbar { display: none; }

        /* ── STEP INDICATOR ── */
        .hp-steps { display:flex; align-items:center; margin-bottom:1.75rem; }
        .hp-step { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
        .hp-step-dot { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800; transition:all 0.25s; border:2px solid transparent; }
        .hp-step-dot.done { background:#4f46e5; border-color:#818cf8; color:#fff; }
        .hp-step-dot.active { background:#4f46e5; border-color:#818cf8; color:#fff; box-shadow:0 0 0 4px rgba(79,70,229,0.25); }
        .hp-step-dot.idle { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.15); color:rgba(255,255,255,0.35); }
        .hp-step-label { font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; }
        .hp-step-line { flex:1; height:2px; margin-bottom:20px; border-radius:1px; transition:background 0.3s; }

        /* ── INPUTS ── */
        .hp-input {
          width:100%; height:50px; padding:0 1rem;
          background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(255,255,255,0.1);
          border-radius:0.875rem; color:#e2e8f0; font-size:0.95rem;
          outline:none; transition:border-color 0.2s;
        }
        .hp-input:focus { border-color:rgba(129,140,248,0.7); background:rgba(255,255,255,0.07); }
        .hp-input::placeholder { color:rgba(255,255,255,0.3); }

        /* ── GPS BUTTON ── */
        .hp-gps-btn {
          width:100%; height:50px;
          background:rgba(255,255,255,0.04);
          border:1.5px solid rgba(255,255,255,0.15);
          border-radius:0.875rem;
          color:rgba(255,255,255,0.85); font-size:0.95rem; font-weight:600;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.625rem;
          transition:all 0.2s;
        }
        .hp-gps-btn:hover { background:rgba(99,102,241,0.15); border-color:rgba(99,102,241,0.4); color:#c7d2fe; }
        .hp-gps-btn.active { background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.4); color:#6ee7b7; }

        /* ── CUSTOM DROPDOWN ── */
        .hp-dropdown { position:relative; }
        .hp-dropdown-trigger {
          width:100%; height:58px; padding:0 1rem;
          background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(255,255,255,0.12);
          border-radius:0.875rem;
          color:#e2e8f0; font-size:0.95rem;
          cursor:pointer; display:flex; align-items:flex-start; flex-direction:column; justify-content:center;
          transition:all 0.2s; text-align:left;
          gap:1px;
        }
        .hp-dropdown-trigger:hover, .hp-dropdown-trigger.open { border-color:rgba(129,140,248,0.6); background:rgba(255,255,255,0.07); }
        .hp-dropdown-label { font-size:0.68rem; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.4px; display:flex; align-items:center; gap:0.3rem; }
        .hp-dropdown-value { font-size:1rem; font-weight:700; color:#e2e8f0; }
        .hp-dropdown-chevron { position:absolute; right:1rem; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.4); transition:transform 0.2s; }
        .hp-dropdown-chevron.open { transform:translateY(-50%) rotate(180deg); }
        .hp-dropdown-menu {
          position:absolute; top:calc(100% + 6px); left:0; right:0;
          background:rgba(20,25,60,0.98);
          backdrop-filter:blur(20px);
          border:1.5px solid rgba(255,255,255,0.12);
          border-radius:0.875rem;
          overflow:hidden;
          z-index:100;
          animation: dropIn 0.15s ease;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
        }
        .hp-dropdown-item {
          width:100%; padding:0.875rem 1.125rem;
          background:transparent; border:none;
          color:rgba(255,255,255,0.75); font-size:0.95rem; font-weight:500;
          cursor:pointer; display:flex; align-items:center; justify-content:space-between;
          text-align:left; transition:background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .hp-dropdown-item:last-child { border-bottom:none; }
        .hp-dropdown-item:hover { background:rgba(99,102,241,0.15); color:#fff; }
        .hp-dropdown-item.selected { background:rgba(79,70,229,0.25); color:#c7d2fe; font-weight:700; }
        .hp-dropdown-check { color:#818cf8; font-size:0.875rem; }

        /* ── PRIMARY / SECONDARY BUTTONS ── */
        .hp-btn-primary {
          width:100%; height:52px;
          background:linear-gradient(135deg,#4f46e5,#7c3aed);
          border:none; border-radius:0.875rem;
          color:#fff; font-weight:800; font-size:0.95rem;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem;
          box-shadow:0 6px 20px rgba(79,70,229,0.4);
          transition:opacity 0.2s, transform 0.15s;
        }
        .hp-btn-primary:hover { opacity:0.92; transform:translateY(-1px); }
        .hp-btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .hp-btn-secondary {
          width:100%; height:50px;
          background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(255,255,255,0.1); border-radius:0.875rem;
          color:rgba(255,255,255,0.65); font-weight:700; font-size:0.9rem;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.4rem;
          transition:background 0.2s;
        }
        .hp-btn-secondary:hover { background:rgba(255,255,255,0.09); }
        .hp-btn-login {
          width:100%; height:52px;
          background:rgba(245,158,11,0.1);
          border:1.5px solid rgba(245,158,11,0.3); border-radius:0.875rem;
          color:#fbbf24; font-weight:800; font-size:0.95rem;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem;
          transition:all 0.2s;
        }
        .hp-btn-login:hover { background:rgba(245,158,11,0.18); }

        /* ── SERVICE CARDS ── */
        .hp-svc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.625rem; margin-bottom:1rem; }
        .hp-svc-card {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:0.4rem; padding:0.875rem 0.4rem;
          background:rgba(255,255,255,0.04);
          border:1.5px solid rgba(255,255,255,0.07);
          border-radius:1rem;
          color:rgba(255,255,255,0.65); font-size:0.8rem; font-weight:600;
          cursor:pointer; transition:all 0.15s; text-align:center;
        }
        .hp-svc-card:hover { border-color:rgba(129,140,248,0.5); background:rgba(79,70,229,0.12); color:#c7d2fe; }
        .hp-svc-card.sel { border-color:rgba(129,140,248,0.8); background:rgba(79,70,229,0.25); color:#c7d2fe; box-shadow:0 0 0 3px rgba(99,102,241,0.2); }

        /* ── DIVIDER ── */
        .hp-divider { display:flex; align-items:center; gap:0.75rem; margin:0.25rem 0; }
        .hp-divider-line { flex:1; height:1px; background:rgba(255,255,255,0.1); }
        .hp-divider-text { color:rgba(255,255,255,0.3); font-size:0.75rem; font-weight:700; }

        /* ── BOTTOM BAR ── */
        .hp-bottom-bar {
          position:relative; z-index:1;
          display:flex; align-items:center; justify-content:center;
          gap:2.5rem; padding:1rem 2rem;
          background:rgba(10,10,30,0.7);
          backdrop-filter:blur(12px);
          border-top:1px solid rgba(255,255,255,0.07);
        }
        .hp-feature { display:flex; align-items:center; gap:0.5rem; }
        .hp-feature-icon { width:32px; height:32px; border-radius:50%; background:rgba(79,70,229,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .hp-feature-text { font-size:0.8rem; }
        .hp-feature-title { color:#e2e8f0; font-weight:700; }
        .hp-feature-sub { color:rgba(255,255,255,0.35); font-size:0.7rem; }

        /* ── MOBILE NAV ── */
        .hp-mobile-nav {
          display:none;
          position:fixed; bottom:0; left:0; right:0; z-index:50;
          background:rgba(15,20,50,0.95);
          backdrop-filter:blur(20px);
          border-top:1px solid rgba(255,255,255,0.1);
          padding:0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom));
        }
        .hp-mobile-nav-inner { display:flex; justify-content:space-around; }
        .hp-mobile-nav-item { display:flex; flex-direction:column; align-items:center; gap:2px; padding:0.375rem 0.875rem; background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); font-size:0.65rem; font-weight:600; text-transform:uppercase; transition:color 0.15s; }
        .hp-mobile-nav-item.active { color:#818cf8; }
        .hp-mobile-nav-item svg { margin-bottom:1px; }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .hp-nav-links { display:none; }
          .hp-body {
            padding: 1.25rem 1rem 5.5rem;
            align-items: flex-start;
            justify-content: center;
          }
          .hp-card { max-width: 100%; padding: 1.5rem 1.25rem; }
          .hp-bottom-bar { display:none; }
          .hp-mobile-nav { display:block; }
          .hp-page { background-attachment: scroll; }
        }
        @media (min-width: 769px) {
          .hp-mobile-nav { display:none !important; }
        }
      `}</style>

      <div className="hp-page">

        {/* ── NAVBAR ── */}
        <nav className="hp-nav">
          <div className="hp-nav-logo">
            <div className="hp-nav-logo-icon">🔧</div>
            Mistri
          </div>
          <div className="hp-nav-links">
            <button className="hp-nav-link">Home</button>
            <button className="hp-nav-link">Find a Service</button>
            <button className="hp-nav-link">How It Works</button>
            <button className="hp-nav-link">For Workers</button>
            <button className="hp-nav-link">Help</button>
          </div>
          <div className="hp-nav-actions">
            {!isLoggedIn ? (
              <>
                <button onClick={openLoginModal} className="hp-nav-login">Login</button>
                <button onClick={openLoginModal} className="hp-nav-signup">Sign Up</button>
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#6ee7b7', fontSize:'0.875rem', fontWeight:700 }}>
                <CheckCircle size={15} /> {customer?.name?.split(' ')[0] || 'Logged in'}
              </div>
            )}
          </div>
        </nav>

        {/* ── BODY ── */}
        <div className="hp-body">
          <div className="hp-card">

            {/* Step indicator */}
            <div className="hp-steps">
              {['Location', 'Service', 'Confirm'].map((label, i) => {
                const n = i + 1; const done = n < step; const active = n === step
                return (
                  <React.Fragment key={label}>
                    <div className="hp-step">
                      <div className={`hp-step-dot ${done ? 'done' : active ? 'active' : 'idle'}`}>
                        {done ? '✓' : n}
                      </div>
                      <div className="hp-step-label" style={{ color: active || done ? '#c7d2fe' : 'rgba(255,255,255,0.3)' }}>{label}</div>
                    </div>
                    {i < 2 && <div className="hp-step-line" style={{ background: done ? '#4f46e5' : 'rgba(255,255,255,0.1)' }} />}
                  </React.Fragment>
                )
              })}
            </div>

            {/* Paused banner */}
            {servicePaused.isPaused && (
              <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', marginBottom:'1.25rem', display:'flex', gap:'0.5rem', alignItems:'center', fontSize:'0.875rem', color:'#fca5a5', fontWeight:600 }}>
                <Clock size={15} style={{ flexShrink:0 }} /> {announcement?.message || 'Services temporarily paused.'}
              </div>
            )}

            {/* ── STEP 1: LOCATION ── */}
            {step === 1 && (
              <div style={{ animation:'fadeUp 0.2s ease', display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div>
                  <h2 style={{ color:'#fff', fontWeight:800, fontSize:'1.5rem', margin:'0 0 0.25rem', lineHeight:1.2 }}>Where do you need help?</h2>
                  <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.875rem', margin:0 }}>Select your district in Jammu &amp; Kashmir</p>
                </div>

                {/* GPS */}
                <button type="button" onClick={handleGps} disabled={isGpsLoading} className={`hp-gps-btn${useGps ? ' active' : ''}`}>
                  <Navigation size={17} style={{ animation: isGpsLoading ? 'spin 0.8s linear infinite' : undefined }} />
                  {isGpsLoading ? 'Detecting your location…' : useGps ? `📍 ${currentArea} (GPS detected)` : 'Use My Location (GPS)'}
                </button>

                <div className="hp-divider">
                  <div className="hp-divider-line" />
                  <span className="hp-divider-text">OR</span>
                  <div className="hp-divider-line" />
                </div>
                <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.8rem', margin:'-0.5rem 0 -0.25rem', textAlign:'center' }}>or choose your district</p>

                {/* Custom Dropdown */}
                <div className="hp-dropdown" ref={dropdownRef}>
                  <button
                    type="button"
                    className={`hp-dropdown-trigger${districtOpen ? ' open' : ''}`}
                    onClick={() => setDistrictOpen(o => !o)}
                  >
                    <span className="hp-dropdown-label">
                      <MapPin size={11} /> District
                    </span>
                    <span className="hp-dropdown-value">
                      {allowedDistricts.length === 0 ? 'Loading…' : selectedDistrict}
                    </span>
                    <ChevronDown size={17} className={`hp-dropdown-chevron${districtOpen ? ' open' : ''}`} />
                  </button>
                  {districtOpen && allowedDistricts.length > 0 && (
                    <div className="hp-dropdown-menu">
                      {allowedDistricts.map(d => (
                        <button
                          key={d}
                          type="button"
                          className={`hp-dropdown-item${d === selectedDistrict ? ' selected' : ''}`}
                          onClick={() => { onAreaChange(d); setUseGps(false); setDistrictOpen(false) }}
                        >
                          {d}
                          {d === selectedDistrict && <span className="hp-dropdown-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PIN search */}
                {!showPinSearch ? (
                  <button type="button" onClick={() => setShowPinSearch(true)} style={{ background:'none', border:'none', color:'#818cf8', fontSize:'0.85rem', fontWeight:600, cursor:'pointer', textAlign:'left', padding:0 }}>
                    🔍 Search by PIN code or area name
                  </button>
                ) : (
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <input type="text" className="hp-input" placeholder="PIN code or area name…" value={locationInput} onChange={e => setLocationInput(e.target.value)} autoFocus style={{ flex:1, height:46 }} />
                    <button type="button" onClick={handleLocationSearch} style={{ height:46, padding:'0 1.125rem', background:'rgba(99,102,241,0.2)', border:'1.5px solid rgba(99,102,241,0.35)', borderRadius:'0.75rem', color:'#a5b4fc', fontWeight:700, cursor:'pointer' }}>Go</button>
                  </div>
                )}

                {!isLoggedIn ? (
                  <button type="button" onClick={openLoginModal} className="hp-btn-login">
                    <LogIn size={17} /> Login / Register to Book
                  </button>
                ) : (
                  <button type="button" onClick={() => setStep(2)} disabled={allowedDistricts.length === 0} className="hp-btn-primary">
                    Next: Choose Service <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}

            {/* ── STEP 2: SERVICE ── */}
            {step === 2 && (
              <div style={{ animation:'fadeUp 0.2s ease', display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div>
                  <h2 style={{ color:'#fff', fontWeight:800, fontSize:'1.35rem', margin:'0 0 0.25rem' }}>What service do you need?</h2>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.85rem', margin:0 }}>Tap a service to select</p>
                </div>
                <div className="hp-svc-grid">
                  {skills.map(skill => (
                    <button key={skill.id} type="button" className={`hp-svc-card${skill.id === selectedSkillId ? ' sel' : ''}`} onClick={() => setSelectedSkillId(skill.id)}>
                      <span style={{ fontSize:'1.75rem', lineHeight:1 }}><ServiceIcon name={skill.name} icon={skill.icon} category={skill.category} size={26} /></span>
                      <span style={{ lineHeight:1.25 }}>{skill.name}</span>
                      {skill.id === selectedSkillId && <span style={{ fontSize:'0.6rem', background:'rgba(129,140,248,0.3)', color:'#a5b4fc', padding:'1px 6px', borderRadius:99 }}>✓ Selected</span>}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'0.625rem' }}>
                  <button type="button" onClick={() => setStep(1)} className="hp-btn-secondary" style={{ flex:1 }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={() => { if (!selectedSkillId) { toast.error('Please select a service.'); return } setStep(3) }} className="hp-btn-primary" style={{ flex:2 }}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: CONFIRM ── */}
            {step === 3 && (
              <div style={{ animation:'fadeUp 0.2s ease', display:'flex', flexDirection:'column', gap:'1rem' }}>
                {!isLoggedIn ? (
                  <div style={{ textAlign:'center', padding:'0.5rem 0' }}>
                    <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'0.875rem', padding:'1.25rem', marginBottom:'1rem', color:'#fbbf24' }}>
                      <LogIn size={24} style={{ marginBottom:'0.5rem' }} />
                      <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:'0.375rem' }}>Login Required</div>
                      <div style={{ fontSize:'0.875rem', opacity:0.85, lineHeight:1.5 }}>Please verify your mobile number with OTP to submit a request.</div>
                    </div>
                    <button type="button" onClick={openLoginModal} className="hp-btn-primary">Login / Register with OTP <ChevronRight size={16} /></button>
                    <button type="button" onClick={() => setStep(2)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'0.85rem', fontWeight:600, marginTop:'0.875rem', cursor:'pointer' }}>← Back to Services</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 style={{ color:'#fff', fontWeight:800, fontSize:'1.25rem', margin:'0 0 0.25rem' }}>Your Contact Details</h2>
                      <div style={{ background:'rgba(79,70,229,0.12)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'0.75rem', padding:'0.625rem 0.875rem', display:'flex', flexWrap:'wrap', gap:'0.5rem 1.25rem', fontSize:'0.85rem', color:'#a5b4fc', fontWeight:600, marginTop:'0.5rem' }}>
                        <span>📍 {currentArea}</span>
                        {selectedSkill && <span>{selectedSkill.icon || '🔧'} {selectedSkill.name}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                      <div>
                        <label style={{ display:'block', color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', fontWeight:700, marginBottom:'0.375rem', textTransform:'uppercase', letterSpacing:'0.4px' }}>Full Name</label>
                        <input className="hp-input" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} required />
                      </div>
                      <div>
                        <label style={{ display:'block', color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', fontWeight:700, marginBottom:'0.375rem', textTransform:'uppercase', letterSpacing:'0.4px' }}>Mobile Number *</label>
                        <div style={{ display:'flex', height:50, border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'0.875rem', overflow:'hidden', background:'rgba(255,255,255,0.04)' }}>
                          <div style={{ padding:'0 0.875rem', background:'rgba(99,102,241,0.15)', borderRight:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'0.25rem', color:'#818cf8', fontSize:'0.9rem', fontWeight:700, flexShrink:0 }}>
                            <Phone size={13} /> +91
                          </div>
                          <input type="tel" inputMode="numeric" maxLength={10} placeholder="98xxxxxxxx" value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, ''))} required style={{ flex:1, border:'none', outline:'none', padding:'0 0.875rem', fontSize:'1rem', fontWeight:600, background:'transparent', color:'#e2e8f0' }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display:'block', color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', fontWeight:700, marginBottom:'0.375rem', textTransform:'uppercase', letterSpacing:'0.4px' }}>Address <span style={{ fontWeight:400, textTransform:'none', opacity:0.6 }}>(optional)</span></label>
                        <input className="hp-input" placeholder="House no., lane, landmark…" value={address} onChange={e => setAddress(e.target.value)} />
                      </div>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                      <button type="submit" disabled={submitting || servicePaused.isPaused} className="hp-btn-primary" style={{ height:54 }}>
                        {submitting
                          ? <><div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.6s linear infinite' }} /> Submitting…</>
                          : <>✓ Confirm &amp; Submit Request</>}
                      </button>
                      <button type="button" onClick={() => setStep(2)} className="hp-btn-secondary">
                        <ArrowLeft size={15} /> Back to Services
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM FEATURES BAR (desktop) ── */}
        <div className="hp-bottom-bar">
          {[
            { icon: <ShieldCheck size={16} color="#818cf8" />, title: 'Verified Professionals', sub: 'Trusted & background checked' },
            { icon: <Zap size={16} color="#818cf8" />, title: 'Quick Booking', sub: 'Get help in minutes' },
            { icon: <MapPin size={16} color="#818cf8" />, title: 'Local Experts', sub: 'In your district' },
            { icon: <Users size={16} color="#818cf8" />, title: 'Safe & Reliable', sub: 'Your safety is our priority' },
          ].map(f => (
            <div className="hp-feature" key={f.title}>
              <div className="hp-feature-icon">{f.icon}</div>
              <div className="hp-feature-text">
                <div className="hp-feature-title">{f.title}</div>
                <div className="hp-feature-sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="hp-mobile-nav">
          <div className="hp-mobile-nav-inner">
            <button className="hp-mobile-nav-item active"><Star size={20} /><span>Home</span></button>
            <button className="hp-mobile-nav-item" onClick={() => navigate('/my-bookings')}><CheckCircle size={20} /><span>Bookings</span></button>
            <button className="hp-mobile-nav-item" onClick={() => navigate('/notifications')}><Clock size={20} /><span>Messages</span></button>
            <button className="hp-mobile-nav-item" onClick={isLoggedIn ? undefined : openLoginModal}><Users size={20} /><span>Profile</span></button>
          </div>
        </nav>
      </div>
    </>
  )
}

export default HomePage
