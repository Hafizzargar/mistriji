import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import {
  fetchSystemAnnouncement,
  saveSystemAnnouncement,
  SystemAnnouncement,
  DEFAULT_ANNOUNCEMENT,
  isServicePaused,
  fetchOperatingDistricts,
  saveOperatingDistricts,
  fetchLocationCatalog,
  saveLocationCatalog,
  fetchFooterSettings,
  saveFooterSettings,
  LocationCatalogEntry,
  DEFAULT_LOCATION_CATALOG,
  FooterSettings,
  DEFAULT_FOOTER_SETTINGS,
  PlatformFeatures,
  DEFAULT_PLATFORM_FEATURES,
  fetchPlatformFeatures,
  savePlatformFeatures,
  PaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
  fetchPaymentSettings,
  savePaymentSettings
} from '@/lib/settings'
import {
  Wrench,
  AlertTriangle,
  CloudSnow,
  Sparkles,
  Megaphone,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  ShieldAlert,
  Calendar,
  X,
  ShieldCheck,
  KeyRound,
  Mail,
  Phone,
  Lock,
} from 'lucide-react'
import { sendOTP, updatePinWithOTP } from '@/lib/authApi'
import { ManageAreasPage } from '@/pages/ManageAreasPage'
import { useAuth } from '@/contexts/AuthContext'

export function SettingsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const isAreasSection = location.pathname.endsWith('/areas')
  const [activeSettingsTab, setActiveSettingsTab] = useState<'announcement' | 'footer' | 'areas' | 'security' | 'payments'>(isAreasSection ? 'areas' : 'announcement')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SystemAnnouncement>(DEFAULT_ANNOUNCEMENT)
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatures>(DEFAULT_PLATFORM_FEATURES)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS)
  const [operatingDistricts, setOperatingDistricts] = useState<string[]>([])
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalogEntry[]>(DEFAULT_LOCATION_CATALOG)
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(DEFAULT_FOOTER_SETTINGS)
  const [districtsLoading, setDistrictsLoading] = useState(false)

  // Security & PIN Update State
  const [securityChannel, setSecurityChannel] = useState<'email' | 'phone'>('email')
  const [securityOtpSent, setSecurityOtpSent] = useState(false)
  const [securityOtp, setSecurityOtp] = useState('')
  const [securityNewPin, setSecurityNewPin] = useState('')
  const [securityConfirmPin, setSecurityConfirmPin] = useState('')
  const [securityShowPin, setSecurityShowPin] = useState(false)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityCountdown, setSecurityCountdown] = useState(0)
  const [newDistrict, setNewDistrict] = useState('')
  const [newArea, setNewArea] = useState('')
  const [selectedDistrictForService, setSelectedDistrictForService] = useState('')
  const [creatingDistrict, setCreatingDistrict] = useState(false)
  const [editingDistrict, setEditingDistrict] = useState<string | null>(null)
  const [districtDraft, setDistrictDraft] = useState('')
  const [editingArea, setEditingArea] = useState<{ district: string; area: string } | null>(null)
  const [areaDraft, setAreaDraft] = useState('')

  const orderedCatalog = [...locationCatalog]
    .map(item => ({
      ...item,
      district: item.district.trim(),
      areas: [...new Set((item.areas || []).map(area => String(area).trim()).filter(Boolean))]
    }))
    .filter(item => item.district)
    .sort((a, b) => a.district.localeCompare(b.district))
    .map(item => ({
      ...item,
      areas: [...item.areas].sort((x, y) => x.localeCompare(y))
    }))
  const activeDistricts = orderedCatalog.filter(item => operatingDistricts.includes(item.district))
  const hiddenDistricts = orderedCatalog.filter(item => !operatingDistricts.includes(item.district))

  useEffect(() => {
    setActiveSettingsTab(isAreasSection ? 'areas' : 'announcement')
  }, [isAreasSection])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await fetchSystemAnnouncement()
      const features = await fetchPlatformFeatures()
      const districts = await fetchOperatingDistricts()
      const catalog = await fetchLocationCatalog()
      const footer = await fetchFooterSettings()
      const pSettings = await fetchPaymentSettings()
      setSettings(data)
      setPlatformFeatures(features)
      setOperatingDistricts(districts)
      setLocationCatalog(catalog.length ? catalog : DEFAULT_LOCATION_CATALOG)
      setFooterSettings(footer)
      setPaymentSettings(pSettings)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setSaving(true)
    const res = await saveSystemAnnouncement({
      ...settings,
      updatedAt: new Date().toISOString()
    })
    const featRes = await savePlatformFeatures(platformFeatures)
    const districtRes = await saveOperatingDistricts(operatingDistricts)
    const catalogRes = await saveLocationCatalog(locationCatalog)
    const footerRes = await saveFooterSettings(footerSettings)
    const paymentRes = await savePaymentSettings(paymentSettings)
    setSaving(false)
    if (res.success && featRes.success && districtRes.success && catalogRes.success && footerRes.success && paymentRes) {
      toast.success('Settings, banner, features, footer, locations, and payments updated successfully!')
    } else {
      toast.error(footerRes.error || catalogRes.error || districtRes.error || featRes.error || res.error || 'Failed to save settings')
    }
  }

  async function createNewDistrict() {
    const district = newDistrict.trim()
    const area = newArea.trim()

    if (!district) {
      toast.error('Please enter a district name.')
      return
    }

    const nextCatalog = [...locationCatalog]
    const existing = nextCatalog.find(item => item.district.toLowerCase() === district.toLowerCase())

    if (existing) {
      if (area) {
        const alreadyExists = existing.areas.some(item => item.toLowerCase() === area.toLowerCase())
        if (alreadyExists) {
          toast.info('This district and area already exist.')
          return
        }
        existing.areas = [...existing.areas, area]
      }
    } else {
      nextCatalog.push({ district, areas: area ? [area] : [] })
    }

    const cleanedCatalog = nextCatalog.filter(entry => entry.areas.length > 0)
    const catalogRes = await saveLocationCatalog(cleanedCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not create district.')
      return
    }

    const nextDistList = Array.from(new Set([...operatingDistricts, district]))
    const districtRes = await saveOperatingDistricts(nextDistList)
    if (!districtRes.success) {
      toast.error(districtRes.error || 'Could not save district service status.')
      return
    }

    setLocationCatalog(cleanedCatalog)
    setOperatingDistricts(nextDistList)
    setSelectedDistrictForService(district)
    setNewDistrict('')
    setNewArea('')
    setCreatingDistrict(false)
    toast.success(`District ${district} ${area ? 'created' : 'added'}${area ? ` with ${area}` : ''}.`)
  }

  async function addNewDistrictArea() {
    const districtFromSelection = selectedDistrictForService.trim()
    const district = (newDistrict.trim() || districtFromSelection).trim()
    const area = newArea.trim()
    if (!district || !area) {
      toast.error('Please enter a district and an area name.')
      return
    }

    const nextCatalog = [...locationCatalog]
    const existing = nextCatalog.find(item => item.district.toLowerCase() === district.toLowerCase())

    if (existing) {
      const alreadyExists = existing.areas.some(item => item.toLowerCase() === area.toLowerCase())
      if (alreadyExists) {
        toast.info('This area already exists in the selected district.')
        return
      }

      existing.areas = [...existing.areas, area]
    } else {
      nextCatalog.push({ district, areas: [area] })
    }

    const nextDistList = Array.from(new Set([...operatingDistricts, district]))

    const catalogRes = await saveLocationCatalog(nextCatalog)
    const districtRes = await saveOperatingDistricts(nextDistList)

    if (!catalogRes.success || !districtRes.success) {
      toast.error(catalogRes.error || districtRes.error || 'Could not save the new location.')
      return
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(nextDistList)
    setSelectedDistrictForService(district)
    setNewDistrict('')
    setNewArea('')
    toast.success(`Added ${area} under ${district}.`)
  }

  function preserveActiveDistricts(nextCatalog: LocationCatalogEntry[], previousActive: string[]): string[] {
    const previousActiveSet = new Set(previousActive.map(value => value.toLowerCase()))
    return nextCatalog
      .filter(entry => entry.areas.length > 0)
      .map(entry => entry.district)
      .filter(district => previousActiveSet.has(district.toLowerCase()))
  }

  async function saveDistrictEdit() {
    const updatedName = districtDraft.trim()
    if (!editingDistrict || !updatedName) {
      toast.error('District name cannot be empty.')
      return
    }

    const wasActive = operatingDistricts.some(item => item.toLowerCase() === editingDistrict.toLowerCase())
    const nextCatalog = orderedCatalog.map(entry => {
      if (entry.district.toLowerCase() === editingDistrict.toLowerCase()) {
        return { ...entry, district: updatedName }
      }
      return entry
    })

    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not update district name.')
      return
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(prev => {
      const withoutOld = prev.filter(item => item.toLowerCase() !== editingDistrict.toLowerCase())
      return wasActive ? Array.from(new Set([...withoutOld, updatedName])) : withoutOld
    })
    setEditingDistrict(null)
    setDistrictDraft('')
    toast.success(`Updated district to ${updatedName}.`)
  }

  async function deleteDistrict(district: string) {
    const nextCatalog = orderedCatalog.filter(entry => entry.district.toLowerCase() !== district.toLowerCase())
    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not delete district.')
      return
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(prev => prev.filter(item => item.toLowerCase() !== district.toLowerCase()))
    toast.success(`Removed district ${district}.`)
  }

  async function deleteArea(district: string, area: string) {
    const districtWasActive = operatingDistricts.some(item => item.toLowerCase() === district.toLowerCase())
    const nextCatalog = orderedCatalog.map(entry => {
      if (entry.district.toLowerCase() !== district.toLowerCase()) return entry
      return { ...entry, areas: entry.areas.filter(item => item.toLowerCase() !== area.toLowerCase()) }
    }).filter(entry => entry.areas.length > 0)

    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not delete area.')
      return
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(prev => {
      const withoutDistrict = prev.filter(item => item.toLowerCase() !== district.toLowerCase())
      const remainingDistricts = preserveActiveDistricts(nextCatalog, prev)
      return districtWasActive ? remainingDistricts : withoutDistrict
    })
    toast.success(`Removed area ${area} from ${district}.`)
  }

  async function saveAreaEdit() {
    if (!editingArea) return

    const updatedArea = areaDraft.trim()
    if (!updatedArea) {
      toast.error('Area name cannot be empty.')
      return
    }

    const nextCatalog = orderedCatalog.map(entry => {
      if (entry.district.toLowerCase() !== editingArea.district.toLowerCase()) return entry
      return {
        ...entry,
        areas: entry.areas.map(area => area.toLowerCase() === editingArea.area.toLowerCase() ? updatedArea : area)
      }
    })

    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not update area name.')
      return
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(prev => preserveActiveDistricts(nextCatalog, prev))
    setEditingArea(null)
    setAreaDraft('')
    toast.success(`Updated area to ${updatedArea}.`)
  }

  function applyPreset(
    type: SystemAnnouncement['type'],
    title: string,
    message: string,
    pauseBookings = false,
    startTime = '',
    endTime = ''
  ) {
    setSettings(prev => ({
      ...prev,
      enabled: true,
      type,
      title,
      message,
      pauseBookings,
      startTime,
      endTime
    }))
    toast.info(`Applied "${title}" template. Click "Save Changes" to publish.`)
  }

  if (isAreasSection) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage operating districts and service areas.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', background: 'var(--gray-100)', borderRadius: '0.75rem', padding: '0.25rem', gap: '0.25rem', border: '1px solid var(--gray-200)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveSettingsTab('announcement')
                navigate('/settings')
              }}
              style={{
                borderRadius: '0.55rem',
                background: activeSettingsTab === 'announcement' ? '#fff' : 'transparent',
                boxShadow: activeSettingsTab === 'announcement' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                color: activeSettingsTab === 'announcement' ? 'var(--gray-900)' : 'var(--gray-600)',
                fontWeight: activeSettingsTab === 'announcement' ? 700 : 600,
                minWidth: 180
              }}
            >
              Announcements
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveSettingsTab('footer')
                navigate('/settings')
              }}
              style={{
                borderRadius: '0.55rem',
                background: activeSettingsTab === 'footer' ? '#fff' : 'transparent',
                boxShadow: activeSettingsTab === 'footer' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                color: activeSettingsTab === 'footer' ? 'var(--gray-900)' : 'var(--gray-600)',
                fontWeight: activeSettingsTab === 'footer' ? 700 : 600,
                minWidth: 120
              }}
            >
              Footer
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveSettingsTab('areas')
                navigate('/settings/areas')
              }}
              style={{
                borderRadius: '0.55rem',
                background: activeSettingsTab === 'areas' ? '#fff' : 'transparent',
                boxShadow: activeSettingsTab === 'areas' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                color: activeSettingsTab === 'areas' ? 'var(--gray-900)' : 'var(--gray-600)',
                fontWeight: activeSettingsTab === 'areas' ? 700 : 600,
                minWidth: 150
              }}
            >
              Manage Areas
            </button>
          </div>
        </div>

        <ManageAreasPage />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: '0.75rem' }}>
        <div className="spinner" style={{ color: 'var(--brand-600)', width: 24, height: 24 }} />
        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading platform settings…</span>
      </div>
    )
  }

  const typeConfig = {
    maintenance: {
      label: 'Maintenance / Service Pause',
      icon: <Wrench size={18} />,
      bg: '#fef2f2',
      border: '#fecaca',
      text: '#991b1b',
      badgeBg: '#fee2e2',
      badgeText: '#b91c1c',
      accentColor: '#dc2626'
    },
    weather: {
      label: 'Weather & Travel Advisory',
      icon: <CloudSnow size={18} />,
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      badgeBg: '#dbeafe',
      badgeText: '#1d4ed8',
      accentColor: '#2563eb'
    },
    holiday: {
      label: 'Holiday / Special Schedule',
      icon: <Sparkles size={18} />,
      bg: '#fdf4ff',
      border: '#f5d0fe',
      text: '#86198f',
      badgeBg: '#fae8ff',
      badgeText: '#a21caf',
      accentColor: '#c026d3'
    },
    custom: {
      label: 'General Notice / Info',
      icon: <Megaphone size={18} />,
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      badgeBg: '#dcfce7',
      badgeText: '#15803d',
      accentColor: '#16a34a'
    }
  }

  const activeTheme = typeConfig[settings.type] || typeConfig.maintenance

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚙️ Settings
          </h1>
          <p className="page-subtitle">
            Configure announcements, footer content, and operating districts.
          </p>
        </div>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 140, justifyContent: 'center' }}
        >
          {saving ? <><span className="spinner" style={{ width: 15, height: 15 }} /> Saving…</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'inline-flex', background: 'var(--gray-100)', borderRadius: '0.75rem', padding: '0.25rem', gap: '0.25rem', border: '1px solid var(--gray-200)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActiveSettingsTab('announcement')
              navigate('/settings')
            }}
            style={{
              borderRadius: '0.55rem',
              background: activeSettingsTab === 'announcement' ? '#fff' : 'transparent',
              boxShadow: activeSettingsTab === 'announcement' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: activeSettingsTab === 'announcement' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeSettingsTab === 'announcement' ? 700 : 600,
              minWidth: 180
            }}
          >
            Announcements
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActiveSettingsTab('footer')
              navigate('/settings')
            }}
            style={{
              borderRadius: '0.55rem',
              background: activeSettingsTab === 'footer' ? '#fff' : 'transparent',
              boxShadow: activeSettingsTab === 'footer' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: activeSettingsTab === 'footer' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeSettingsTab === 'footer' ? 700 : 600,
              minWidth: 120
            }}
          >
            Footer
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActiveSettingsTab('areas')
              navigate('/settings/areas')
            }}
            style={{
              borderRadius: '0.55rem',
              background: activeSettingsTab === 'areas' ? '#fff' : 'transparent',
              boxShadow: activeSettingsTab === 'areas' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: activeSettingsTab === 'areas' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeSettingsTab === 'areas' ? 700 : 600,
              minWidth: 150
            }}
          >
            Manage Areas
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActiveSettingsTab('security')
              navigate('/settings')
            }}
            style={{
              borderRadius: '0.55rem',
              background: activeSettingsTab === 'security' ? '#fff' : 'transparent',
              boxShadow: activeSettingsTab === 'security' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: activeSettingsTab === 'security' ? 'var(--gray-900)' : 'var(--gray-600)',
              fontWeight: activeSettingsTab === 'security' ? 700 : 600,
              minWidth: 160,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
          >
            <ShieldCheck size={14} style={{ color: '#4f46e5' }} /> Security & PIN
          </button>
          
          {user?.role === 'super_admin' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveSettingsTab('payments')
                navigate('/settings')
              }}
              style={{
                borderRadius: '0.55rem',
                background: activeSettingsTab === 'payments' ? '#fff' : 'transparent',
                boxShadow: activeSettingsTab === 'payments' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                color: activeSettingsTab === 'payments' ? 'var(--gray-900)' : 'var(--gray-600)',
                fontWeight: activeSettingsTab === 'payments' ? 700 : 600,
                minWidth: 150
              }}
            >
              Payments & Commission
            </button>
          )}
        </div>
      </div>

      {activeSettingsTab === 'payments' && user?.role === 'super_admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💰 Payment & Commission Settings (Super Admin)
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.75rem', border: '1px solid var(--gray-200)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={paymentSettings.customerPaymentsEnabled}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, customerPaymentsEnabled: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  Enable Online Payments for Customers (Razorpay)
                </label>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)', marginLeft: '2.25rem' }}>
                  If disabled, customers will bypass the payment screen and simply submit their requests.
                </p>
              </div>

              <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.75rem', border: '1px solid var(--gray-200)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={paymentSettings.workerPaymentsEnabled}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, workerPaymentsEnabled: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  Enable Subscription/Commission System for Workers
                </label>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)', marginLeft: '2.25rem' }}>
                  If disabled, workers will not be prompted to link their Razorpay or subscribe to MistriJi.
                </p>
              </div>

              {paymentSettings.workerPaymentsEnabled && (
                <div style={{ marginTop: '0.5rem', padding: '1rem', border: '1px solid var(--gray-200)', borderRadius: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600 }}>Commission Split Type</label>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="commissionType"
                        value="percentage"
                        checked={paymentSettings.type === 'percentage'}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, type: e.target.value as 'percentage' | 'fixed' })}
                      />
                      Percentage (%)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="commissionType"
                        value="fixed"
                        checked={paymentSettings.type === 'fixed'}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, type: e.target.value as 'percentage' | 'fixed' })}
                      />
                      Fixed Amount (₹)
                    </label>
                  </div>

                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Commission Value {paymentSettings.type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={paymentSettings.type === 'percentage' ? '100' : undefined}
                    value={paymentSettings.value}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, value: Number(e.target.value) })}
                    className="input"
                    style={{ maxWidth: '200px' }}
                  />
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                    This amount will be deducted from the customer's payment as MistriJi's fee using Razorpay Route. The remainder will be sent directly to the assigned worker's bank account.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSettingsTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Super Admin Identity Badge */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#fff', border: 'none', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  ⭐
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Super Administrator</h2>
                    <span style={{ background: '#4f46e5', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      Master Root Account
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Permanent Credentials: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>hafezzargar987@gmail.com</span> &nbsp;•&nbsp; <span style={{ color: '#e2e8f0', fontWeight: 600 }}>+91 6005950197</span>
                  </p>
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '0.4rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.775rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck size={15} /> Permanent Security Policy Active
              </div>
            </div>
          </div>

          {/* OTP-Protected PIN Update Card */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 40, height: 40, borderRadius: '0.625rem', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Update Access PIN (OTP-Protected)
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  To ensure platform security, changing the Super Admin 6-digit access PIN requires real-time OTP verification.
                </p>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              const cleanOtp = securityOtp.trim()
              const cleanPin = securityNewPin.trim()
              const cleanConfirm = securityConfirmPin.trim()

              if (!securityOtpSent || cleanOtp.length !== 6) {
                toast.error('Please request and enter the 6-digit OTP code first.')
                return
              }

              if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
                toast.error('New PIN must be exactly 6 numeric digits.')
                return
              }

              if (cleanPin !== cleanConfirm) {
                toast.error('New PIN and Confirm PIN do not match.')
                return
              }

              setSecurityLoading(true)
              const identifier = securityChannel === 'email' ? 'hafezzargar987@gmail.com' : '6005950197'
              const res = await updatePinWithOTP(identifier, cleanOtp, cleanPin, securityChannel)
              setSecurityLoading(false)

              if (!res.success) {
                toast.error(res.error || 'Failed to update PIN.')
                return
              }

              toast.success(`Super Admin PIN successfully updated to ${cleanPin}!`)
              setSecurityOtpSent(false)
              setSecurityOtp('')
              setSecurityNewPin('')
              setSecurityConfirmPin('')
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Step 1: Channel selection */}
                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                    1. Select Verification Channel
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: 500 }}>
                    <button
                      type="button"
                      onClick={() => { setSecurityChannel('email'); setSecurityOtpSent(false); }}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.625rem',
                        border: `1.5px solid ${securityChannel === 'email' ? '#4f46e5' : '#e2e8f0'}`,
                        background: securityChannel === 'email' ? '#eef2ff' : '#fff',
                        color: securityChannel === 'email' ? '#4f46e5' : '#475569',
                        fontWeight: 600,
                        fontSize: '0.825rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Mail size={16} />
                      <div>
                        <div>Email OTP</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>hafezzargar987@gmail.com</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setSecurityChannel('phone'); setSecurityOtpSent(false); }}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.625rem',
                        border: `1.5px solid ${securityChannel === 'phone' ? '#4f46e5' : '#e2e8f0'}`,
                        background: securityChannel === 'phone' ? '#eef2ff' : '#fff',
                        color: securityChannel === 'phone' ? '#4f46e5' : '#475569',
                        fontWeight: 600,
                        fontSize: '0.825rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Phone size={16} />
                      <div>
                        <div>SMS OTP</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>+91 6005950197</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Step 2: OTP verification code */}
                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                    2. Security OTP Verification Code
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', maxWidth: 450, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input"
                      value={securityOtp}
                      onChange={e => setSecurityOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      disabled={!securityOtpSent}
                      style={{ letterSpacing: '3px', fontWeight: 700, textAlign: 'center', fontSize: '1rem', width: 180 }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setSecurityLoading(true)
                        const identifier = securityChannel === 'email' ? 'hafezzargar987@gmail.com' : '6005950197'
                        const result = await sendOTP(identifier, securityChannel)
                        setSecurityLoading(false)

                        if (!result.success) {
                          toast.error(result.error || 'Failed to send OTP.')
                          return
                        }

                        setSecurityOtpSent(true)
                        setSecurityCountdown(60)
                        toast.success(`OTP sent to ${securityChannel === 'email' ? 'hafezzargar987@gmail.com' : '+91 6005950197'}!`)
                      }}
                      disabled={securityLoading || securityCountdown > 0}
                      className="btn btn-secondary"
                      style={{ height: 42, padding: '0 1rem', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {securityLoading ? 'Sending…' : securityCountdown > 0 ? `Resend in ${securityCountdown}s` : securityOtpSent ? 'Resend OTP' : 'Send Verification OTP'}
                    </button>
                  </div>
                </div>

                {/* Step 3: New PIN */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: 500, paddingTop: '0.5rem' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      New 6-Digit PIN <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={15} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                      <input
                        type={securityShowPin ? 'text' : 'password'}
                        className="input"
                        value={securityNewPin}
                        onChange={e => setSecurityNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="••••••"
                        style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', letterSpacing: '2px', fontWeight: 700 }}
                      />
                      <button
                        type="button"
                        onClick={() => setSecurityShowPin(v => !v)}
                        style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                      >
                        {securityShowPin ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      Confirm New PIN <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={15} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                      <input
                        type={securityShowPin ? 'text' : 'password'}
                        className="input"
                        value={securityConfirmPin}
                        onChange={e => setSecurityConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="••••••"
                        style={{ paddingLeft: '2.25rem', letterSpacing: '2px', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={securityLoading || !securityOtpSent || securityOtp.length < 6 || securityNewPin.length < 6}
                    style={{ minWidth: 220, height: 44, fontWeight: 700, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {securityLoading ? 'Updating PIN…' : 'Verify OTP & Update Access PIN'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Razorpay Integration Card */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '0.625rem', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Online Payments (Razorpay)
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Enable or disable online payments across the platform. Requires backend API keys.
                  </p>
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="checkbox"
                    checked={platformFeatures.razorpay_enabled}
                    onChange={(e) => setPlatformFeatures(prev => ({ ...prev, razorpay_enabled: e.target.checked }))}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  <div style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: platformFeatures.razorpay_enabled ? '#10b981' : '#e2e8f0',
                    transition: 'background 0.2s',
                    position: 'relative',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: platformFeatures.razorpay_enabled ? 22 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: platformFeatures.razorpay_enabled ? '#10b981' : '#64748b' }}>
                  {platformFeatures.razorpay_enabled ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
            
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontWeight: 600, fontSize: '0.9rem', height: 44, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Payment Settings'}
            </button>
          </div>
        </div>
      )}

      {activeSettingsTab === 'announcement' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', background: '#fafafa', border: '1.5px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-800)' }}>
                <Eye size={16} style={{ color: 'var(--brand-600)' }} />
                Customer Website Live Preview
              </div>
              <span className={`badge ${settings.enabled ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.75rem' }}>
                {settings.enabled ? '● Banner Active' : '○ Banner Inactive (Hidden)'}
              </span>
            </div>

            {settings.enabled ? (
              <div style={{ background: activeTheme.bg, border: `1.5px solid ${activeTheme.border}`, color: activeTheme.text, borderRadius: '0.75rem', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', transition: 'all 200ms ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeTheme.accentColor, boxShadow: '0 2px 4px rgba(0,0,0,0.08)', flexShrink: 0 }}>
                    {activeTheme.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.2px' }}>{settings.title || 'Service Notice'}</span>
                      {(settings.startTime || settings.endTime) && (
                        <span style={{ background: activeTheme.badgeBg, color: activeTheme.badgeText, padding: '2px 8px', borderRadius: 12, fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {settings.startTime || 'Start'} – {settings.endTime || 'End'}
                        </span>
                      )}
                      {settings.pauseBookings && (
                        <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 12, fontSize: '0.725rem', fontWeight: 700 }}>⚠️ Bookings Paused</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.825rem', opacity: 0.9, marginTop: 2 }}>{settings.message || 'Announcement details will appear here...'}</div>
                  </div>
                </div>
                {settings.dismissible && (
                  <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: activeTheme.text, opacity: 0.6, padding: 4 }} title="Dismiss banner">
                    <X size={18} />
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.85rem', background: '#fff', borderRadius: '0.5rem', border: '1px dashed var(--gray-300)' }}>
                Banner is currently <strong>disabled</strong>. Turn the switch ON below to show this notice at the top of the customer website.
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1.5px solid var(--brand-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gray-900)' }}>Platform Features: Dispatch Mode</div>
                <div style={{ fontSize: '0.825rem', color: 'var(--gray-500)', marginTop: 2 }}>
                  Controls how jobs are assigned when a customer submits a request. Note: You must click "Save Changes" at the bottom to apply.
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div 
                onClick={() => setPlatformFeatures(prev => ({ ...prev, dispatch_mode: 'manual' }))}
                style={{ border: platformFeatures.dispatch_mode === 'manual' ? '2px solid var(--brand-600)' : '1.5px solid var(--gray-200)', background: platformFeatures.dispatch_mode === 'manual' ? '#eff6ff' : '#fff', borderRadius: '0.625rem', padding: '1rem', cursor: 'pointer', transition: 'all 150ms ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <ShieldAlert size={18} style={{ color: platformFeatures.dispatch_mode === 'manual' ? 'var(--brand-600)' : 'var(--gray-400)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Manual Assignment</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>Jobs go to Admin panel. Workers won't see them until Admin explicitly assigns them.</div>
              </div>

              <div 
                onClick={() => setPlatformFeatures(prev => ({ ...prev, dispatch_mode: 'auto' }))}
                style={{ border: platformFeatures.dispatch_mode === 'auto' ? '2px solid var(--brand-600)' : '1.5px solid var(--gray-200)', background: platformFeatures.dispatch_mode === 'auto' ? '#f0fdf4' : '#fff', borderRadius: '0.625rem', padding: '1rem', cursor: 'pointer', transition: 'all 150ms ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Sparkles size={18} style={{ color: platformFeatures.dispatch_mode === 'auto' ? '#16a34a' : 'var(--gray-400)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Auto Broadcast</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>Jobs are broadcasted immediately to all eligible workers in the area for them to accept.</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.25rem', borderBottom: '1px solid var(--gray-200)', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gray-900)' }}>Enable Top Announcement Banner</div>
                <div style={{ fontSize: '0.825rem', color: 'var(--gray-500)', marginTop: 2 }}>When enabled, this message will display prominently at the very top of all customer pages.</div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 52, height: 28, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.enabled} onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, backgroundColor: settings.enabled ? 'var(--brand-600)' : 'var(--gray-300)', borderRadius: 34, transition: '0.2s' }}>
                  <span style={{ position: 'absolute', height: 20, width: 20, left: 4, bottom: 4, backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s', transform: settings.enabled ? 'translateX(24px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" style={{ marginBottom: '0.625rem' }}>⚡ 1-Click Quick Templates</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.625rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => applyPreset('maintenance', 'Scheduled Maintenance Notice', 'Our booking services will be temporarily paused tonight from 11:00 PM to 3:00 AM for planned server upgrades.', true, '23:00', '03:00')} style={{ fontSize: '0.8rem', textAlign: 'left', padding: '0.625rem 0.75rem', height: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Wrench size={16} style={{ color: '#dc2626', flexShrink: 0 }} /><div><div style={{ fontWeight: 600 }}>Scheduled Night Maintenance</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>11:00 PM – 03:00 AM (Pause bookings)</div></div></button>
                <button type="button" className="btn btn-secondary" onClick={() => applyPreset('weather', 'Weather Advisory in J&K', 'Due to heavy rainfall / snowfall in Ramban and Kashmir regions, worker arrivals may experience slight delays.', false)} style={{ fontSize: '0.8rem', textAlign: 'left', padding: '0.625rem 0.75rem', height: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><CloudSnow size={16} style={{ color: '#2563eb', flexShrink: 0 }} /><div><div style={{ fontWeight: 600 }}>J&K Weather Alert</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Rain/Snow delay advisory</div></div></button>
                <button type="button" className="btn btn-secondary" onClick={() => applyPreset('holiday', 'Festive Special Operations', 'Happy Holidays! MistriJi emergency technicians and electricians are operating 24/7 across Jammu district.', false)} style={{ fontSize: '0.8rem', textAlign: 'left', padding: '0.625rem 0.75rem', height: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Sparkles size={16} style={{ color: '#c026d3', flexShrink: 0 }} /><div><div style={{ fontWeight: 600 }}>Holiday 24/7 Support</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Festive emergency teams</div></div></button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" style={{ marginBottom: '0.5rem' }}>Alert Category & Theme</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {(['maintenance', 'weather', 'holiday', 'custom'] as const).map(typeKey => {
                  const cfg = typeConfig[typeKey]
                  const isSelected = settings.type === typeKey
                  return (
                    <div key={typeKey} onClick={() => setSettings(prev => ({ ...prev, type: typeKey }))} style={{ border: isSelected ? `2px solid ${cfg.accentColor}` : '1.5px solid var(--gray-200)', background: isSelected ? cfg.bg : '#fff', borderRadius: '0.625rem', padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem', transition: 'all 150ms ease' }}>
                      <div style={{ color: cfg.accentColor }}>{cfg.icon}</div>
                      <div style={{ fontSize: '0.825rem', fontWeight: isSelected ? 700 : 500, color: 'var(--gray-800)' }}>{cfg.label.split('/')[0]}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="input-wrapper">
                <label className="input-label">Banner Title <span className="required">*</span></label>
                <input type="text" className="input" value={settings.title} onChange={e => setSettings(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Service Notice or Maintenance Alert" required />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Message Text <span className="required">*</span></label>
                <textarea className="input" rows={3} value={settings.message} onChange={e => setSettings(prev => ({ ...prev, message: e.target.value }))} placeholder="Explain clearly to customers what is happening..." required style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="input-wrapper" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Pause Start Time (Optional)</label>
                <input type="time" className="input" value={settings.startTime} onChange={e => setSettings(prev => ({ ...prev, startTime: e.target.value }))} />
              </div>
              <div className="input-wrapper" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Pause End Time (Optional)</label>
                <input type="time" className="input" value={settings.endTime} onChange={e => setSettings(prev => ({ ...prev, endTime: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                  <input type="checkbox" checked={settings.pauseBookings} onChange={e => setSettings(prev => ({ ...prev, pauseBookings: e.target.checked }))} />
                  🚫 Pause New Bookings in Customer App
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                  <input type="checkbox" checked={settings.dismissible} onChange={e => setSettings(prev => ({ ...prev, dismissible: e.target.checked }))} />
                  Allow customers to close banner (Dismissible)
                </label>
              </div>
            </div>

            <div style={{ padding: '1.25rem', background: '#f8fafc', border: '1.5px solid var(--gray-200)', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📞 Platform Support & Emergency Helpline Numbers</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Configure the real phone numbers and contacts shown on the customer app and service pause notices. All dynamic from backend — no hardcoded numbers.</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Emergency Helpline Phone</label>
                  <input type="text" className="input" placeholder="e.g. +91 9876543210" value={settings.helplinePhone ?? ''} onChange={e => setSettings(prev => ({ ...prev, helplinePhone: e.target.value }))} />
                </div>
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>WhatsApp Support Number</label>
                  <input type="text" className="input" placeholder="e.g. +91 9876543210" value={settings.whatsappNumber ?? ''} onChange={e => setSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))} />
                </div>
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Customer Support Email</label>
                  <input type="email" className="input" placeholder="e.g. support@mistriji.com" value={settings.supportEmail ?? ''} onChange={e => setSettings(prev => ({ ...prev, supportEmail: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSettings(DEFAULT_ANNOUNCEMENT)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><RotateCcw size={15} /> Reset to Defaults</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 160, justifyContent: 'center' }}>{saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : <><Save size={16} /> Save Changes</>}</button>
            </div>
          </form>
        </>
      )}

      {activeSettingsTab === 'footer' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--gray-900)' }}>Footer</div>
              <div style={{ fontSize: '0.825rem', color: 'var(--gray-500)', marginTop: 2 }}>Manage footer branding, coverage, support contact info, and copyright text.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', paddingTop: '0.25rem' }}>
            <div className="input-wrapper" style={{ margin: 0 }}>
              <label className="input-label">Brand Name</label>
              <input className="input" value={footerSettings.brandName} onChange={e => setFooterSettings(prev => ({ ...prev, brandName: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0 }}>
              <label className="input-label">Footer Enabled</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: 42 }}>
                <input type="checkbox" checked={footerSettings.enabled} onChange={e => setFooterSettings(prev => ({ ...prev, enabled: e.target.checked }))} />
              </div>
            </div>
            <div className="input-wrapper" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Footer Description</label>
              <textarea className="input" rows={3} value={footerSettings.description} onChange={e => setFooterSettings(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Coverage Areas</label>
              <textarea className="input" rows={3} value={footerSettings.coverageAreas.join(', ')} onChange={e => setFooterSettings(prev => ({ ...prev, coverageAreas: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Gandhi Nagar, Satwari, Jammu" />
            </div>
            <div className="input-wrapper" style={{ margin: 0 }}>
              <label className="input-label">Helpline Phone</label>
              <input className="input" value={footerSettings.helplinePhone} onChange={e => setFooterSettings(prev => ({ ...prev, helplinePhone: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0 }}>
              <label className="input-label">WhatsApp Number</label>
              <input className="input" value={footerSettings.whatsappNumber} onChange={e => setFooterSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0 }}>
              <label className="input-label">Support Email</label>
              <input className="input" value={footerSettings.supportEmail} onChange={e => setFooterSettings(prev => ({ ...prev, supportEmail: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Office Address</label>
              <input className="input" value={footerSettings.officeAddress} onChange={e => setFooterSettings(prev => ({ ...prev, officeAddress: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Copyright Text</label>
              <input className="input" value={footerSettings.copyrightText} onChange={e => setFooterSettings(prev => ({ ...prev, copyrightText: e.target.value }))} />
            </div>
            <div className="input-wrapper" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label className="input-label">Built With Text</label>
              <input className="input" value={footerSettings.builtWithText} onChange={e => setFooterSettings(prev => ({ ...prev, builtWithText: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {activeSettingsTab === 'areas' && <ManageAreasPage />}
    </div>
  )
}
