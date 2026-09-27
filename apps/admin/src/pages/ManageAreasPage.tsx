import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { logAdminAction } from '@/lib/auditLogger'
import { useToast } from '@/contexts/ToastContext'
import {
  fetchOperatingDistricts,
  saveOperatingDistricts,
  fetchLocationCatalog,
  saveLocationCatalog,
  LocationCatalogEntry,
  DEFAULT_LOCATION_CATALOG
} from '@/lib/settings'
import { MapPinned } from 'lucide-react'

export function ManageAreasPage() {
  const toast = useToast()
  const { user: currentAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalogEntry[]>(DEFAULT_LOCATION_CATALOG)
  const [operatingDistricts, setOperatingDistricts] = useState<string[]>([])
  const [newDistrict, setNewDistrict] = useState('')
  const [newArea, setNewArea] = useState('')
  const [selectedDistrictForService, setSelectedDistrictForService] = useState('')
  const [creatingDistrict, setCreatingDistrict] = useState(false)
  const [editingDistrict, setEditingDistrict] = useState<string | null>(null)
  const [districtDraft, setDistrictDraft] = useState('')
  const [editingArea, setEditingArea] = useState<{ district: string; area: string } | null>(null)
  const [areaDraft, setAreaDraft] = useState('')
  const [deletingDistrict, setDeletingDistrict] = useState<string | null>(null)
  const [deletingArea, setDeletingArea] = useState<{ district: string; area: string } | null>(null)

  const normalizeDistrictName = (value: string) => String(value || '').trim().toLowerCase()

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

  const districtIsActive = (district: string) =>
    operatingDistricts.some(item => normalizeDistrictName(item) === normalizeDistrictName(district))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const districts = await fetchOperatingDistricts()
      const catalog = await fetchLocationCatalog()
      
      const loadedCatalog = catalog.length ? catalog : DEFAULT_LOCATION_CATALOG
      setLocationCatalog(loadedCatalog)

      // Auto-cleanup operating districts that don't exist in catalog
      const catalogDistrictNames = new Set(loadedCatalog.map(c => c.district.toLowerCase()))
      const cleanedDistricts = districts.filter(d => catalogDistrictNames.has(d.toLowerCase()))
      
      if (cleanedDistricts.length !== districts.length) {
         await saveOperatingDistricts(cleanedDistricts)
      }
      setOperatingDistricts(cleanedDistricts)

      setLoading(false)
    }
    void load()
  }, [])

  function preserveActiveDistricts(nextCatalog: LocationCatalogEntry[], previousActive: string[]): string[] {
    const previousActiveSet = new Set(previousActive.map(value => value.toLowerCase()))
    return nextCatalog
      .filter(entry => entry.areas.length > 0)
      .map(entry => entry.district)
      .filter(district => previousActiveSet.has(district.toLowerCase()))
  }

  async function toggleDistrictService(district: string) {
    const trimmedDistrict = String(district || '').trim()
    const isActivating = !districtIsActive(trimmedDistrict)
    const nextActiveDistricts = !isActivating
      ? operatingDistricts
          .map(item => String(item || '').trim())
          .filter(item => item && normalizeDistrictName(item) !== normalizeDistrictName(trimmedDistrict))
      : Array.from(new Set([
          ...operatingDistricts.map(item => String(item || '').trim()).filter(Boolean),
          trimmedDistrict
        ]))

    const districtRes = await saveOperatingDistricts(nextActiveDistricts)
    if (!districtRes.success) {
      toast.error(districtRes.error || 'Could not update district status.')
      return
    }

    setOperatingDistricts(nextActiveDistricts)

    await logAdminAction({
      actor: currentAdmin,
      action: isActivating ? 'Operating District Activated' : 'Operating District Deactivated',
      targetType: 'district',
      details: `${isActivating ? 'activated' : 'deactivated'} service operations in district "${trimmedDistrict}"`,
      newValue: isActivating
    })
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
      const alreadyExists = existing.areas.some(item => item.toLowerCase() === area.toLowerCase())
      if (area && alreadyExists) {
        toast.info('This district and area already exist.')
        return
      }

      if (area) {
        existing.areas = [...existing.areas, area]
      }
    } else {
      nextCatalog.push({ district, areas: area ? [area] : [] })
    }

    const catalogRes = await saveLocationCatalog(nextCatalog)
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

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(nextDistList)
    setSelectedDistrictForService(district)
    setNewDistrict('')
    setNewArea('')
    setCreatingDistrict(false)
    toast.success(`District ${district} ${area ? 'created' : 'added'}${area ? ` with ${area}` : ''}.`)

    await logAdminAction({
      actor: currentAdmin,
      action: 'District Created',
      targetType: 'location_catalog',
      details: `created new district "${district}"${area ? ` with initial area "${area}"` : ''}`,
    })
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

    await logAdminAction({
      actor: currentAdmin,
      action: 'Operational Area Added',
      targetType: 'location_catalog',
      details: `added new area "${area}" under district "${district}"`,
    })
  }

  async function deleteDistrict(district: string) {
    const nextCatalog = orderedCatalog.filter(entry => entry.district.toLowerCase() !== district.toLowerCase())
    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not delete district.')
      return
    }

    const nextDistList = operatingDistricts.filter(item => item.toLowerCase() !== district.toLowerCase())
    await saveOperatingDistricts(nextDistList)

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(nextDistList)
    if (selectedDistrictForService.toLowerCase() === district.toLowerCase()) {
      setSelectedDistrictForService('')
    }
    setNewDistrict('')
    setNewArea('')
    toast.success(`Removed district ${district}.`)

    await logAdminAction({
      actor: currentAdmin,
      action: 'District Deleted',
      targetType: 'location_catalog',
      details: `removed district "${district}" and all its associated areas from catalog`,
    })
  }

  async function deleteArea(district: string, area: string) {
    const nextCatalog = orderedCatalog
      .map(entry => {
        if (entry.district.toLowerCase() !== district.toLowerCase()) return entry
        return { ...entry, areas: entry.areas.filter(item => item.toLowerCase() !== area.toLowerCase()) }
      })
      .filter(entry => entry.areas.length > 0)

    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not delete area.')
      return
    }

    const validDistricts = new Set(nextCatalog.map(c => c.district.toLowerCase()))
    const nextDistList = operatingDistricts.filter(item => validDistricts.has(item.toLowerCase()))
    if (nextDistList.length !== operatingDistricts.length) {
      await saveOperatingDistricts(nextDistList)
    }

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(nextDistList)
    setEditingArea(null)
    setAreaDraft('')
    toast.success(`Removed area ${area} from ${district}.`)

    await logAdminAction({
      actor: currentAdmin,
      action: 'Operational Area Deleted',
      targetType: 'location_catalog',
      details: `removed area "${area}" from district "${district}"`,
    })
  }

  async function saveDistrictEdit() {
    const updatedName = districtDraft.trim()
    if (!editingDistrict || !updatedName) {
      toast.error('District name cannot be empty.')
      return
    }

    const previousName = editingDistrict

    const nextCatalog = orderedCatalog.map(entry => {
      if (entry.district.toLowerCase() !== editingDistrict.toLowerCase()) return entry
      return { ...entry, district: updatedName }
    })

    const catalogRes = await saveLocationCatalog(nextCatalog)
    if (!catalogRes.success) {
      toast.error(catalogRes.error || 'Could not update district name.')
      return
    }

    const nextDistList = operatingDistricts.map(item => 
      item.toLowerCase() === editingDistrict.toLowerCase() ? updatedName : item
    )
    await saveOperatingDistricts(nextDistList)

    setLocationCatalog(nextCatalog)
    setOperatingDistricts(nextDistList)
    setSelectedDistrictForService(updatedName)
    setEditingDistrict(null)
    setDistrictDraft('')
    toast.success(`Updated district to ${updatedName}.`)

    await logAdminAction({
      actor: currentAdmin,
      action: 'District Renamed',
      targetType: 'location_catalog',
      details: `renamed district from "${previousName}" to "${updatedName}"`,
      oldValue: previousName,
      newValue: updatedName
    })
  }

  async function saveAreaEdit() {
    if (!editingArea) return

    const updatedArea = areaDraft.trim()
    if (!updatedArea) {
      toast.error('Area name cannot be empty.')
      return
    }

    const previousArea = editingArea.area

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
    const districtContext = editingArea.district
    setEditingArea(null)
    setAreaDraft('')
    toast.success(`Updated area to ${updatedArea}.`)

    await logAdminAction({
      actor: currentAdmin,
      action: 'Area Renamed',
      targetType: 'location_catalog',
      details: `renamed area in "${districtContext}" from "${previousArea}" to "${updatedArea}"`,
      oldValue: previousArea,
      newValue: updatedArea
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: '0.75rem' }}>
        <div className="spinner" style={{ color: 'var(--brand-600)', width: 24, height: 24 }} />
        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading service areas…</span>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPinned size={22} style={{ color: 'var(--brand-600)' }} /> Manage Areas
          </h1>
          <p className="page-subtitle">
            Add, edit, and manage districts and service areas for active coverage zones.
          </p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--gray-900)' }}>
            Jammu Division
          </div>
          <button type="button" className="btn btn-primary" onClick={() => {
            setCreatingDistrict(true)
            setSelectedDistrictForService('')
            setNewDistrict('')
            setNewArea('')
          }}>
            + Add New District
          </button>
        </div>

        {creatingDistrict && (
          <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '0.9rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--gray-900)', marginBottom: '0.75rem' }}>Create a new district</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
              <input
                value={newDistrict}
                onChange={e => setNewDistrict(e.target.value)}
                className="input"
                placeholder="District name"
              />
              <input
                value={newArea}
                onChange={e => setNewArea(e.target.value)}
                className="input"
                placeholder="First area name (optional)"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createNewDistrict()
                  }
                }}
              />
              <button type="button" className="btn btn-primary" onClick={() => void createNewDistrict()}>Create District</button>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid var(--gray-200)', borderRadius: '0.9rem', background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1rem 0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1.3fr 0.9fr 1fr 60px', gap: '0.65rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-600)', padding: '0 0.25rem 0.5rem' }}>
              <span>#</span>
              <span>District Name</span>
              <span>Status</span>
              <span>Areas</span>
              <span style={{ textAlign: 'right' }}>Action</span>
            </div>

            {orderedCatalog.map((entry, index) => {
              const isActive = districtIsActive(entry.district)
              const status = isActive ? 'Active' : 'Inactive'
              const isSelected = selectedDistrictForService === entry.district

              return (
                <div
                  key={entry.district}
                  style={{ borderTop: '1px solid var(--gray-200)', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedDistrictForService(prev => prev === entry.district ? '' : entry.district)
                    setNewDistrict(prev => prev || entry.district)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedDistrictForService(prev => prev === entry.district ? '' : entry.district)
                      setNewDistrict(prev => prev || entry.district)
                    }
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '45px 1.3fr 0.9fr 1fr 60px',
                    gap: '0.65rem',
                    alignItems: 'center',
                    padding: '0.7rem 0.25rem',
                    fontSize: '0.82rem',
                    background: isSelected ? '#f8fafc' : isActive ? '#f0fdf4' : '#f9fafb',
                    opacity: isActive ? 1 : 0.72,
                    transition: 'all 150ms ease'
                  }}>
                    <span style={{ fontWeight: 700, color: isActive ? 'var(--gray-800)' : 'var(--gray-500)' }}>{index + 1}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, color: isActive ? 'var(--gray-900)' : 'var(--gray-500)' }}>{entry.district}</span>

                    <span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void toggleDistrictService(entry.district)
                        }}
                        style={{
                          border: 'none',
                          width: 36,
                          height: 20,
                          borderRadius: 999,
                          background: isActive ? '#22c55e' : '#d1d5db',
                          position: 'relative',
                          cursor: 'pointer',
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)'
                        }}
                        aria-label={`${status} toggle`}
                      >
                        <span style={{
                          display: 'block',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 3,
                          left: isActive ? 19 : 3,
                          transition: 'all 0.2s ease'
                        }} />
                      </button>
                      <span style={{ marginLeft: '0.45rem', color: isActive ? '#16a34a' : '#6b7280', fontWeight: 600 }}>{status}</span>
                    </span>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center', minWidth: 0 }}>
                      {entry.areas.length ? (
                        <>
                          {entry.areas.slice(0, 3).map(area => (
                            <span key={`${entry.district}-${area}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.14rem 0.38rem', fontSize: '0.66rem', borderRadius: 999, background: '#e2e8f0', color: '#334155', whiteSpace: 'nowrap' }}>
                              {area}
                            </span>
                          ))}
                          {entry.areas.length > 3 && (
                            <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700 }}>+{entry.areas.length - 3}</span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>No areas</span>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDistrictForService(entry.district)
                          setNewDistrict(entry.district)
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>


                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selectedDistrictForService && orderedCatalog.some(e => e.district === selectedDistrictForService) && (
        <div style={modalStyles.overlay} onClick={() => setSelectedDistrictForService('')}>
          <div 
             style={{ ...modalStyles.card, maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
             onClick={e => e.stopPropagation()}
          >
            {(() => {
              const entry = orderedCatalog.find(e => e.district === selectedDistrictForService)!;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--gray-900)' }}>Manage Areas: {entry.district}</div>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setSelectedDistrictForService('')}>Close</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)', gap: '1rem', alignItems: 'start' }}>
                    <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '0.75rem', padding: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Areas List</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{entry.areas.length} total</span>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              setSelectedDistrictForService('')
                              setDeletingDistrict(entry.district)
                            }}
                            style={{
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              borderRadius: '0.4rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            Delete district
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {entry.areas.map(area => (
                          <div key={`${entry.district}-${area}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid var(--gray-200)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem' }}>
                            {editingArea?.district === entry.district && editingArea?.area === area ? (
                              <input
                                value={areaDraft}
                                onChange={e => setAreaDraft(e.target.value)}
                                className="input"
                                style={{ minHeight: '2rem', fontSize: '0.8rem' }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') void saveAreaEdit()
                                  if (e.key === 'Escape') setEditingArea(null)
                                }}
                                onClick={event => event.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-800)' }}>{area}</span>
                            )}

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              {editingArea?.district === entry.district && editingArea?.area === area ? (
                                <>
                                  <button type="button" className="btn btn-primary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => void saveAreaEdit()}>Save</button>
                                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => setEditingArea(null)}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={event => {
                                    event.stopPropagation()
                                    setEditingArea({ district: entry.district, area })
                                    setAreaDraft(area)
                                  }}>Edit</button>
                                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', borderColor: '#fecaca', color: '#b91c1c' }} onClick={event => {
                                    event.stopPropagation()
                                    setDeletingArea({ district: entry.district, area })
                                  }}>Delete</button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '0.75rem', padding: '0.8rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--gray-900)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Add area</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.55rem' }}>
                        <input
                          value={selectedDistrictForService || newDistrict || entry.district}
                          onChange={e => setNewDistrict(e.target.value)}
                          className="input"
                          placeholder="District name"
                          style={{ minHeight: '2.2rem' }}
                          readOnly
                          onClick={event => event.stopPropagation()}
                        />
                        <input
                          value={newArea}
                          onChange={e => setNewArea(e.target.value)}
                          className="input"
                          placeholder="Add area, e.g. Sidhra"
                          style={{ minHeight: '2.2rem' }}
                          onClick={event => event.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.stopPropagation()
                              void addNewDistrictArea()
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={event => {
                            event.stopPropagation()
                            void addNewDistrictArea()
                          }}
                          style={{ minHeight: '2.2rem' }}
                        >
                          + Add Area
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {deletingDistrict && (
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.card, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Delete District?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
              Are you sure you want to delete <strong>{deletingDistrict}</strong> and all of its areas?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingDistrict(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                void deleteDistrict(deletingDistrict)
                setDeletingDistrict(null)
              }}>Delete District</button>
            </div>
          </div>
        </div>
      )}

      {deletingArea && (
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.card, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Delete Area?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
              Are you sure you want to delete <strong>{deletingArea.area}</strong> from <strong>{deletingArea.district}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingArea(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                void deleteArea(deletingArea.district, deletingArea.area)
                setDeletingArea(null)
              }}>Delete Area</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '0.75rem',
    width: '100%',
    maxWidth: 480,
    padding: '1.5rem',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
}
