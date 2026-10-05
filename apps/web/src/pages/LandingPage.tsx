import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { Menu, X, MapPin, CheckCircle, Search, ChevronDown, Check, AlertCircle, RotateCcw } from 'lucide-react'
import './LandingPage.css'
import { fetchFooterSettings, fetchOperatingDistricts, fetchLocationCatalog, LocationCatalogEntry, FooterSettings } from '@/lib/settings'

export function LandingPage() {
  const navigate = useNavigate()
  const { openLoginModal, isLoggedIn, customer } = useCustomerAuth()
  const isAppMode = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || (window as any).Capacitor?.isNativePlatform?.() === true)
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([])
  const [catalog, setCatalog] = useState<LocationCatalogEntry[]>([])
  
  // Searchable district & area states
  const [districtSearch, setDistrictSearch] = useState<string>('')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('')
  const [isDistrictOpen, setIsDistrictOpen] = useState<boolean>(false)
  const [areaSearch, setAreaSearch] = useState<string>('')
  const [selectedArea, setSelectedArea] = useState<string>('')
  const [isAreaOpen, setIsAreaOpen] = useState<boolean>(false)

  const districtBoxRef = useRef<HTMLDivElement>(null)
  const areaBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (districtBoxRef.current && !districtBoxRef.current.contains(e.target as Node)) {
        setIsDistrictOpen(false)
      }
      if (areaBoxRef.current && !areaBoxRef.current.contains(e.target as Node)) {
        setIsAreaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchFooterSettings().then(setFooterSettings)
    Promise.all([fetchLocationCatalog(), fetchOperatingDistricts()]).then(([cat, activeDists]) => {
      const activeCatalog = activeDists && activeDists.length > 0
        ? cat.filter(c => activeDists.some(d => d.toLowerCase() === c.district.toLowerCase()))
        : cat
      setCatalog(cat)
      setAvailableDistricts(
        (activeDists && activeDists.length > 0 ? activeDists : activeCatalog.map(c => c.district)).filter(Boolean)
      )
    })
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn && customer) {
      if (customer.role === 'worker') {
        navigate('/worker/dashboard')
      } else {
        navigate('/customer/dashboard')
      }
    }
  }, [isLoggedIn, customer, navigate])

  const stageRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Intersection Observer for scroll animations
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            e.target.querySelectorAll('[data-n]').forEach((el) => {
              const htmlEl = el as HTMLElement
              const n = +(htmlEl.dataset.n || 0)
              const s = performance.now()
              const count = (now: number) => {
                const p = Math.min(1, (now - s) / 2000)
                htmlEl.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))).toLocaleString() + '+'
                if (p < 1) requestAnimationFrame(count)
              }
              requestAnimationFrame(count)
            })
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    document.querySelectorAll('.rv').forEach((e) => io.observe(e))

    // 3D effect for stage and phone
    const handleStageMove = (e: MouseEvent) => {
      if (!stageRef.current || !phoneRef.current) return
      const r = stageRef.current.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      phoneRef.current.style.transform = `rotateY(${x * 34}deg) rotateX(${-y * 22}deg)`
    }
    const handleStageLeave = () => {
      if (phoneRef.current) phoneRef.current.style.transform = ''
    }

    if (stageRef.current) {
      stageRef.current.addEventListener('mousemove', handleStageMove)
      stageRef.current.addEventListener('mouseleave', handleStageLeave)
    }

    // 3D effect for cards
    const cards = document.querySelectorAll('.card')
    const handleCardMove = function(this: HTMLElement, e: Event) {
      const mouseEvent = e as MouseEvent
      const r = this.getBoundingClientRect()
      const x = (mouseEvent.clientX - r.left) / r.width - 0.5
      const y = (mouseEvent.clientY - r.top) / r.height - 0.5
      this.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg) translateY(-4px)`
    }
    const handleCardLeave = function(this: HTMLElement) {
      this.style.transform = ''
    }

    cards.forEach((c) => {
      c.addEventListener('mousemove', handleCardMove)
      c.addEventListener('mouseleave', handleCardLeave)
    })

    return () => {
      io.disconnect()
      if (stageRef.current) {
        stageRef.current.removeEventListener('mousemove', handleStageMove)
        stageRef.current.removeEventListener('mouseleave', handleStageLeave)
      }
      cards.forEach((c) => {
        c.removeEventListener('mousemove', handleCardMove)
        c.removeEventListener('mouseleave', handleCardLeave)
      })
    }
  }, [])

  const handleAction = (actionPath: string) => {
    if (actionPath === '/customer/login') {
      openLoginModal()
    } else if (actionPath === '/worker/login' || actionPath === '/worker/register') {
      window.dispatchEvent(new Event('open-worker-register'))
    }
  }

  return (
    <div className="landing-page">
      <header>
        <div className="w nav">
          <a href="#top" className="brand">
            <svg width="34" height="34" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="18" fill="#2563eb" />
              <g fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round">
                <path d="M15 50V33a9 9 0 0 1 18 0v17" />
                <path d="M33 33a9 9 0 0 1 18 0v17" />
              </g>
              <circle cx="42" cy="15" r="5" fill="#f97316" />
            </svg>
            Mistri<em>Ji</em>
          </a>
          <nav className="links desktop-only">
            <a href="#top" className="on">Home</a>
            <a href="#services">Services</a>
            <a href="#how">How It Works</a>
            <a href="#city">About Us</a>
            <a href="#footer">Contact</a>
            <a href="#footer">Support</a>
          </nav>
          <span className="sp"></span>
          

          <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Sidebar */}
        <div className={`mobile-drawer ${isMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <span className="drawer-title">MistriJi</span>
            <button className="close-btn" onClick={() => setIsMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="drawer-content">
            <a href="#top" onClick={() => setIsMenuOpen(false)}>🏠 Home</a>
            
            {isLoggedIn ? (
              <>
                <a href={customer?.role === 'worker' ? '/worker/dashboard' : '/customer/dashboard'}>
                  📋 {customer?.role === 'worker' ? 'My Jobs' : 'My Bookings'}
                </a>
              </>
            ) : (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setIsMenuOpen(false); handleAction('/customer/login') }}>👤 Login as Customer</a>
                <a href="#" onClick={(e) => { e.preventDefault(); setIsMenuOpen(false); handleAction('/worker/login') }}>🔨 Login as Worker</a>
              </>
            )}

            <a href="#footer" onClick={() => setIsMenuOpen(false)}>💬 Support</a>
          </div>
        </div>
        <div className={`drawer-overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)} />
      </header>

      <main id="top">
        <div className="w">
          <div className="hero">
            <div>
              <h1>
                Find Trusted Local Service Professionals with <span className="shim">MistriJi</span>
              </h1>
              <p className="lead">
                Book verified workers for home and business services.<br />Fast • Reliable • Local • Affordable
              </p>

              {/* Service Availability Checker - Prominent Hero Position */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1.75rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', maxWidth: '440px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                    <MapPin size={16} color="#2563eb" /> Check Service Availability
                  </h4>
                  {(selectedDistrict || districtSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistrict('')
                        setDistrictSearch('')
                        setSelectedArea('')
                        setAreaSearch('')
                        setIsDistrictOpen(false)
                        setIsAreaOpen(false)
                      }}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 6px', borderRadius: '4px' }}
                      title="Reset search"
                    >
                      <RotateCcw size={12} /> Clear
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* District Searchable Input */}
                  <div ref={districtBoxRef} style={{ position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search district (e.g. Doda, Jammu)..."
                        value={districtSearch}
                        onFocus={() => setIsDistrictOpen(true)}
                        onChange={(e) => {
                          setDistrictSearch(e.target.value)
                          setSelectedDistrict('')
                          setSelectedArea('')
                          setAreaSearch('')
                          setIsDistrictOpen(true)
                        }}
                        style={{
                          width: '100%',
                          padding: '0.6rem 2.2rem 0.6rem 2.2rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          fontSize: '0.9rem',
                          outline: 'none',
                          color: '#0f172a'
                        }}
                      />
                      {districtSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDistrictSearch('')
                            setSelectedDistrict('')
                            setSelectedArea('')
                            setAreaSearch('')
                            setIsDistrictOpen(true)
                          }}
                          style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <ChevronDown size={16} style={{ position: 'absolute', right: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
                      )}
                    </div>

                    {/* District Dropdown Results */}
                    {isDistrictOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          borderRadius: '0.5rem',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          border: '1px solid #e2e8f0',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          zIndex: 50,
                          padding: '4px'
                        }}
                      >
                        {(() => {
                          const matches = availableDistricts.filter(d =>
                            d.toLowerCase().includes(districtSearch.toLowerCase().trim())
                          )
                          if (matches.length === 0) {
                            return (
                              <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                                <AlertCircle size={16} color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                No serviceable district found for "{districtSearch}". More areas coming soon!
                              </div>
                            )
                          }
                          return matches.map(d => (
                            <div
                              key={d}
                              onClick={() => {
                                setSelectedDistrict(d)
                                setDistrictSearch(d)
                                setIsDistrictOpen(false)
                                setSelectedArea('')
                                setAreaSearch('')
                                setIsAreaOpen(true)
                              }}
                              style={{
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                borderRadius: '0.375rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: selectedDistrict.toLowerCase() === d.toLowerCase() ? '#eff6ff' : 'transparent',
                                color: selectedDistrict.toLowerCase() === d.toLowerCase() ? '#1d4ed8' : '#1e293b',
                                fontWeight: selectedDistrict.toLowerCase() === d.toLowerCase() ? 600 : 400
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = selectedDistrict.toLowerCase() === d.toLowerCase() ? '#eff6ff' : 'transparent')}
                            >
                              <span>📍 {d}</span>
                              {selectedDistrict.toLowerCase() === d.toLowerCase() && <Check size={14} color="#2563eb" />}
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Area Searchable / Selection (Visible when District is Selected) */}
                  {selectedDistrict && (() => {
                    const currentEntry = catalog.find(c => c.district.toLowerCase() === selectedDistrict.toLowerCase())
                    const areasList = currentEntry?.areas || []

                    if (areasList.length === 0) return null

                    const matchingAreas = areasList.filter(a =>
                      a.toLowerCase().includes(areaSearch.toLowerCase().trim())
                    )

                    return (
                      <div ref={areaBoxRef} style={{ position: 'relative', animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
                          <input
                            type="text"
                            placeholder={`Search or select area in ${selectedDistrict}...`}
                            value={areaSearch}
                            onFocus={() => setIsAreaOpen(true)}
                            onChange={(e) => {
                              setAreaSearch(e.target.value)
                              setSelectedArea('')
                              setIsAreaOpen(true)
                            }}
                            style={{
                              width: '100%',
                              padding: '0.6rem 2.2rem 0.6rem 2.2rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              fontSize: '0.9rem',
                              outline: 'none',
                              color: '#0f172a'
                            }}
                          />
                          {areaSearch ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAreaSearch('')
                                setSelectedArea('')
                                setIsAreaOpen(true)
                              }}
                              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                            >
                              <X size={16} />
                            </button>
                          ) : (
                            <ChevronDown size={16} style={{ position: 'absolute', right: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
                          )}
                        </div>

                        {isAreaOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: '4px',
                              background: '#ffffff',
                              borderRadius: '0.5rem',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                              border: '1px solid #e2e8f0',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              zIndex: 50,
                              padding: '4px'
                            }}
                          >
                            {matchingAreas.length === 0 ? (
                              <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                                No specific area matched "{areaSearch}".
                              </div>
                            ) : (
                              matchingAreas.map(a => (
                                <div
                                  key={a}
                                  onClick={() => {
                                    setSelectedArea(a)
                                    setAreaSearch(a)
                                    setIsAreaOpen(false)
                                  }}
                                  style={{
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    borderRadius: '0.375rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: selectedArea.toLowerCase() === a.toLowerCase() ? '#eff6ff' : 'transparent',
                                    color: selectedArea.toLowerCase() === a.toLowerCase() ? '#1d4ed8' : '#1e293b',
                                    fontWeight: selectedArea.toLowerCase() === a.toLowerCase() ? 600 : 400
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = selectedArea.toLowerCase() === a.toLowerCase() ? '#eff6ff' : 'transparent')}
                                >
                                  <span>{a}</span>
                                  {selectedArea.toLowerCase() === a.toLowerCase() && <Check size={14} color="#2563eb" />}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Available Confirmation Banner */}
                {selectedDistrict && selectedArea && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontSize: '0.875rem', fontWeight: 600, background: '#f0fdf4', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0', animation: 'slideUp 0.2s ease' }}>
                    <CheckCircle size={18} style={{ flexShrink: 0, color: '#16a34a' }} />
                    <span>Yes! We are active &amp; available in <b>{selectedArea}, {selectedDistrict}</b>.</span>
                  </div>
                )}
              </div>

              <div className="cta">
                <div style={{ flex: 1 }}>
                  <button className="b or lg" style={{ width: '100%' }} onClick={() => handleAction('/customer/login')}>
                    👤 Login as Customer
                  </button>
                  <small>Book a service for your home</small>
                </div>
                <div style={{ flex: 1 }}>
                  <button className="b bl lg" style={{ width: '100%' }} onClick={() => handleAction('/worker/login')}>
                    ⛑ Login as Worker
                  </button>
                  <small>Find jobs and grow your income</small>
                </div>
              </div>
              <div className="trust">
                <div><i>🛡</i>Verified Professionals</div>
                <div><i>⏱</i>Quick Booking</div>
                <div><i>📍</i>Local Workers Near You</div>
                <div><i>₹</i>Affordable Pricing</div>
              </div>
            </div>
            {!isAppMode && (
              <div className="stage" id="stage" ref={stageRef}>
                <span className="hand">Skilled Workers<br />at Your Service</span>
                <span className="fb">🚰</span>
                <span className="fb">⚡</span>
                <span className="fb">🪚</span>
                <div className="phone" id="phone" ref={phoneRef}>
                  <div className="scr">
                    <div className="t">
                      <span>MistriJi</span>
                      <span>🔍</span>
                    </div>
                    <div className="s">📍 Doda, J&amp;K</div>
                    <div className="s">Search for service…</div>
                    <div className="ap">
                      <div><i>🚰</i>Plumber</div>
                      <div><i>⚡</i>Electrician</div>
                      <div><i>🪚</i>Carpenter</div>
                      <div><i>🎨</i>Painter</div>
                      <div><i>❄️</i>AC Repair</div>
                      <div><i>🧹</i>Cleaning</div>
                      <div><i>🧱</i>Mason</div>
                      <div><i>👷</i>Labour</div>
                      <div><i>⋯</i>View All</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isAppMode && (
            <>
              <section id="services" className="rv">
                <h2>🔧 Our Services</h2>
                <p className="sub">A wide range of home and business services, all at one place.</p>
                <div className="grid">
                  <div className="card"><i>🚰</i><b>Plumber</b><small>Pipe, leakage, installation</small></div>
                  <div className="card"><i>⚡</i><b>Electrician</b><small>Wiring, repair, installation</small></div>
                  <div className="card"><i>🪚</i><b>Carpenter</b><small>Furniture, repair, wood work</small></div>
                  <div className="card"><i>🎨</i><b>Painter</b><small>Home &amp; wall painting</small></div>
                  <div className="card"><i>❄️</i><b>AC Repair</b><small>Installation &amp; servicing</small></div>
                  <div className="card"><i>🧹</i><b>Cleaning</b><small>Home &amp; office cleaning</small></div>
                  <div className="card"><i>🧱</i><b>Mason</b><small>Construction &amp; repair</small></div>
                  <div className="card"><i>👷</i><b>Labour</b><small>General labour work</small></div>
                </div>
              </section>

              <section id="how" className="rv">
                <div className="how">
                  <div>
                    <h2>⚙ How MistriJi Works?</h2>
                    <p className="sub">Get your work done in 3 simple steps</p>
                    <div className="steps">
                      <div className="step"><u>1</u><i>🔎</i><b>Choose a Service</b><small>Select the service you need and enter your area</small></div>
                      <div className="step"><u>2</u><i>👷</i><b>Find Trusted Workers</b><small>Get verified professionals near you</small></div>
                      <div className="step"><u>3</u><i>📅</i><b>Book &amp; Get it Done</b><small>Confirm booking and track your service</small></div>
                    </div>
                  </div>
                  <div className="join">
                    <h3>📈 Are You a Skilled Worker?</h3>
                    <p>Join MistriJi and get regular job opportunities in your area. Grow your income with us.</p>
                    <div>
                      <button className="b or" onClick={() => handleAction('/worker/register')}>Register as Worker →</button>
                    </div>
                  </div>
                </div>
              </section>

              <section id="city" className="rv">
                <div className="city">
                  <div className="map">
                    <h3>📍 Available in Your City</h3>
                    <p>More areas coming soon…</p>
                  </div>
                  <div className="stats">
                    <div><b data-n="500">0</b><small>Verified Workers</small></div>
                    <div><b data-n="1000">0</b><small>Happy Customers</small></div>
                    <div><b data-n="50">0</b><small>Services Available</small></div>
                    <div><b>4.8★</b><small>Average Rating</small></div>
                  </div>
                </div>
              </section>

              <section className="rv">
                <div className="feat">
                  <div><i>🛡</i><span><b>Safe &amp; Secure</b><br /><small>All workers are verified and background checked for your safety.</small></span></div>
                  <div><i>₹</i><span><b>Transparent Pricing</b><br /><small>Get fair and transparent pricing with no hidden charges.</small></span></div>
                  <div><i>🎧</i><span><b>24/7 Support</b><br /><small>Need help? Our support team is always here for you.</small></span></div>
                </div>
              </section>

              <section className="rv">
                <h2>⭐ What Our Users Say</h2>
                <p className="sub">Trusted by customers and workers in Doda</p>
                <div className="tg">
                  <div className="q">
                    <p>"Very easy to book a plumber. The worker was professional and on time. Highly recommended!"</p>
                    <div className="st">★★★★★</div>
                    <div className="who"><span>I</span><div><b>Imran Khan</b><br />Customer, Doda</div></div>
                  </div>
                  <div className="q">
                    <p>"Great platform for workers. I get regular jobs and the support team is very helpful."</p>
                    <div className="st">★★★★★</div>
                    <div className="who"><span>S</span><div><b>Shabnam Bano</b><br />Worker, Doda</div></div>
                  </div>
                  <div className="q">
                    <p>"Reliable service and good pricing. MistriJi made home repair so simple."</p>
                    <div className="st">★★★★★</div>
                    <div className="who"><span>R</span><div><b>Rohit Sharma</b><br />Customer, Jammu</div></div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <footer id="footer">
        <div className="w">
          {!isAppMode && (
            <div className="fg">
              <div>
                <div className="brand" style={{ color: '#fff' }}>MistriJi</div>
                <p>MistriJi connects customers with trusted local service professionals. Fast, reliable, and affordable services in Doda and nearby areas.</p>
              </div>
              <div>
                <h4>Quick Links</h4>
                <a href="#top">Home</a>
                <a href="#services">Services</a>
                <a href="#how">How It Works</a>
                <a href="#city">About Us</a>
              </div>
              <div>
                <h4>For Users</h4>
                <a href="#" onClick={(e) => { e.preventDefault(); handleAction('/customer/login'); }}>Customer Login</a>
                <a href="#" onClick={(e) => { e.preventDefault(); handleAction('/worker/login'); }}>Worker Login</a>
                <a href="#" onClick={(e) => { e.preventDefault(); handleAction('/worker/register'); }}>Register as Worker</a>
              </div>
              <div>
                <h4>Support</h4>
                <p>📞 +91 98765 43210</p>
                <p>✉ support@mistriji.com</p>
                <p>📍 Doda, Jammu &amp; Kashmir</p>
                <p>🕘 Mon - Sun: 9:00 AM - 8:00 PM</p>
              </div>
              <div>
                <h4>Download App</h4>
                {!footerSettings?.playStoreUrl && !footerSettings?.appStoreUrl && (
                  <p style={{ fontSize: '12px' }}>Coming soon on Android &amp; iOS</p>
                )}
                {footerSettings?.playStoreUrl && (
                  <a href={footerSettings.playStoreUrl} target="_blank" rel="noopener noreferrer" className="sto" style={{ display: 'inline-block' }}>
                    ▶ Google Play
                  </a>
                )}
                {footerSettings?.playStoreUrl && <br />}
                {footerSettings?.appStoreUrl && (
                  <a href={footerSettings.appStoreUrl} target="_blank" rel="noopener noreferrer" className="sto" style={{ display: 'inline-block' }}>
                     App Store
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="cp" style={{ textAlign: 'center', padding: isAppMode ? '1rem 0' : undefined }}>
            <span>© 2026 MistriJi. All rights reserved.</span>
            {!isAppMode && <span>Privacy Policy | Terms &amp; Conditions</span>}
          </div>
        </div>
      </footer>
    </div>
  )
}
