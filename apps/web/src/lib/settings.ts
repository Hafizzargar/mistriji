import { supabase } from './supabase'
import { JAMMU_AREAS } from './jammuCoordinates'

export interface SystemAnnouncement {
  enabled: boolean
  type: 'maintenance' | 'weather' | 'holiday' | 'custom'
  title: string
  message: string
  startTime: string
  endTime: string
  pauseBookings: boolean
  dismissible: boolean
  helplinePhone?: string
  whatsappNumber?: string
  supportEmail?: string
  updatedAt: string
}

export const DEFAULT_ANNOUNCEMENT: SystemAnnouncement = {
  enabled: true,
  type: 'maintenance',
  title: 'Service Notice',
  message: 'Our services will be paused tonight from 11:00 PM to 3:00 AM for scheduled server maintenance.',
  startTime: '23:00',
  endTime: '03:00',
  pauseBookings: false,
  dismissible: true,
  helplinePhone: '',
  whatsappNumber: '',
  supportEmail: '',
  updatedAt: new Date().toISOString(),
}

export interface PlatformFeatures {
  show_preferred_time: boolean
  show_worker_phones: boolean
  allow_direct_calls: boolean
  assignment_mode: 'auto' | 'manual'
}

export const DEFAULT_PLATFORM_FEATURES: PlatformFeatures = {
  show_preferred_time: true,
  show_worker_phones: false,
  allow_direct_calls: false,
  assignment_mode: 'auto',
}

export interface PaymentSettings {
  customerPaymentsEnabled: boolean
  workerPaymentsEnabled: boolean
  type: 'percentage' | 'fixed'
  value: number
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  customerPaymentsEnabled: false,
  workerPaymentsEnabled: false,
  type: 'percentage',
  value: 10
}

export const STORAGE_KEY = 'mistriji_system_announcement'
export const FEATURES_STORAGE_KEY = 'mistriji_platform_features'
export const OPERATING_DISTRICTS_KEY = 'mistriji_operating_districts'
export const LOCATION_CATALOG_KEY = 'mistriji_location_catalog'
export const FOOTER_SETTINGS_KEY = 'mistriji_footer_settings'
export const PAYMENT_SETTINGS_KEY = 'mistriji_payment_settings'
export const DEFAULT_OPERATING_DISTRICTS: string[] = []

export interface LocationCatalogEntry {
  district: string
  areas: string[]
}

export interface FooterSettings {
  enabled: boolean
  brandName: string
  description: string
  coverageAreas: string[]
  helplinePhone: string
  whatsappNumber: string
  supportEmail: string
  officeAddress: string
  copyrightText: string
  builtWithText: string
  playStoreUrl?: string
  appStoreUrl?: string
}

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  enabled: true,
  brandName: 'MistriJi Jammu',
  description: 'Connecting Jammu residents with trusted, verified local mistris and skilled labourers nearby. Electricians, plumbers, masons, painters, AC technicians, and carpenters sorted by real-time proximity.',
  coverageAreas: ['Gandhi Nagar', 'Trikuta Nagar', 'Satwari', 'Janipur', 'Bakshi Nagar', 'Channi Himmat', 'Talab Tillo', 'Jewel Chowk'],
  helplinePhone: '+91 9876543210',
  whatsappNumber: '+91 9876543210',
  supportEmail: 'support@mistriji.com',
  officeAddress: 'Jammu Head Office, J&K',
  copyrightText: '© 2026 MistriJi Jammu. All rights reserved.',
  builtWithText: 'Built with ❤️ for Jammu Community',
  playStoreUrl: '',
  appStoreUrl: ''
}

export const DEFAULT_LOCATION_CATALOG: LocationCatalogEntry[] = [
  { district: 'Jammu', areas: ['Gandhi Nagar','Trikuta Nagar','Satwari','Bakshi Nagar','Janipur','Channi Himmat','Jewel Chowk','Talab Tillo','Digiana','Bari Brahmana','RS Pura','Nagrota'] },
  { district: 'Samba', areas: ['Samba'] },
  { district: 'Kathua', areas: ['Kathua'] },
  { district: 'Udhampur', areas: ['Udhampur'] },
  { district: 'Reasi', areas: ['Katra','Reasi'] },
  { district: 'Rajouri', areas: ['Rajouri'] },
  { district: 'Poonch', areas: ['Poonch'] },
  { district: 'Doda', areas: ['Doda','Bhaderwah','Kishtwar'] },
  { district: 'Ramban', areas: ['Ramban','Banihal'] },
  { district: 'Srinagar', areas: ['Srinagar','Hazratbal (Srinagar)'] },
  { district: 'Anantnag', areas: ['Anantnag','Pahalgam'] },
  { district: 'Baramulla', areas: ['Baramulla','Gulmarg'] },
  { district: 'Pulwama', areas: ['Pulwama'] },
  { district: 'Shopian', areas: ['Shopian'] },
  { district: 'Budgam', areas: ['Budgam'] },
  { district: 'Ganderbal', areas: ['Ganderbal'] },
  { district: 'Kulgam', areas: ['Kulgam'] },
  { district: 'Kupwara', areas: ['Kupwara'] },
  { district: 'Bandipora', areas: ['Bandipora'] },
]

export function normalizeLocationCatalog(value: any): LocationCatalogEntry[] {
  if (!value) return DEFAULT_LOCATION_CATALOG
  if (Array.isArray(value)) {
    const list = value.filter(Boolean).map((entry: any) => ({
      district: String(entry?.district || '').trim(),
      areas: Array.isArray(entry?.areas) ? entry.areas.filter(Boolean).map(String) : []
    })).filter(entry => entry.district && entry.areas.length > 0)
    return list.length > 0 ? list : DEFAULT_LOCATION_CATALOG
  }
  if (typeof value === 'object') {
    const list = Object.entries(value).map(([district, areas]) => ({
      district,
      areas: Array.isArray(areas) ? areas.filter(Boolean).map(String) : String(areas || '').split(',').map(item => item.trim()).filter(Boolean)
    })).filter(entry => entry.district && entry.areas.length > 0)
    return list.length > 0 ? list : DEFAULT_LOCATION_CATALOG
  }
  return DEFAULT_LOCATION_CATALOG
}

export async function fetchLocationCatalog(): Promise<LocationCatalogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', LOCATION_CATALOG_KEY)
      .maybeSingle()

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      const catalog = normalizeLocationCatalog(parsed)
      localStorage.setItem(LOCATION_CATALOG_KEY, JSON.stringify(catalog))
      return catalog
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LOCATION_CATALOG_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      return normalizeLocationCatalog(parsed)
    }
  } catch {}

  return DEFAULT_LOCATION_CATALOG
}

export async function fetchOperatingDistricts(forceRefresh = false): Promise<string[]> {
  const now = Date.now()
  if (!forceRefresh && (globalThis as any).__mistriji_operating_districts_cache) {
    return (globalThis as any).__mistriji_operating_districts_cache
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'operating_districts')
      .maybeSingle()

    if (!error && data?.value !== null && data?.value !== undefined) {
      const parsed = Array.isArray(data.value) ? data.value : JSON.parse(String(data.value))
      const list = Array.isArray(parsed) ? parsed.filter(Boolean) : []
      ;(globalThis as any).__mistriji_operating_districts_cache = list
      localStorage.setItem(OPERATING_DISTRICTS_KEY, JSON.stringify(list))
      return list
    }
  } catch (err) {
    console.warn('Operating districts fetch warning:', err)
  }

  try {
    const cached = localStorage.getItem(OPERATING_DISTRICTS_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      const list = Array.isArray(parsed) ? parsed.filter(Boolean) : []
      ;(globalThis as any).__mistriji_operating_districts_cache = list
      return list
    }
  } catch {}

  ;(globalThis as any).__mistriji_operating_districts_cache = []
  return []
}

export async function saveOperatingDistricts(districts: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanList = Array.from(new Set((districts || []).filter(Boolean)))
    const { error } = await supabase.from('system_settings').upsert({
      key: 'operating_districts',
      value: cleanList,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    if (error) throw error

    ;(globalThis as any).__mistriji_operating_districts_cache = cleanList
    localStorage.setItem(OPERATING_DISTRICTS_KEY, JSON.stringify(cleanList))
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save operating districts.' }
  }
}

export async function fetchFooterSettings(): Promise<FooterSettings> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', FOOTER_SETTINGS_KEY)
      .maybeSingle()

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      const merged = { ...DEFAULT_FOOTER_SETTINGS, ...parsed }
      localStorage.setItem(FOOTER_SETTINGS_KEY, JSON.stringify(merged))
      return merged
    }
  } catch {}

  try {
    const cached = localStorage.getItem(FOOTER_SETTINGS_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      return { ...DEFAULT_FOOTER_SETTINGS, ...parsed }
    }
  } catch {}

  return { ...DEFAULT_FOOTER_SETTINGS }
}

export async function saveFooterSettings(settings: FooterSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      ...DEFAULT_FOOTER_SETTINGS,
      ...settings,
      coverageAreas: Array.from(new Set((settings.coverageAreas || []).map(item => String(item).trim()).filter(Boolean))),
    }

    const { error } = await supabase.from('system_settings').upsert({
      key: FOOTER_SETTINGS_KEY,
      value: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    if (error) throw error

    localStorage.setItem(FOOTER_SETTINGS_KEY, JSON.stringify(payload))
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save footer settings.' }
  }
}

export function isServicePaused(announcement: SystemAnnouncement | null): { isPaused: boolean; reason?: string } {
  if (!announcement || !announcement.enabled) return { isPaused: false }
  
  // 1. Explicit admin toggle
  if (announcement.pauseBookings) {
    return {
      isPaused: true,
      reason: announcement.message || 'Bookings are temporarily paused by administration.'
    }
  }

  // 2. Active time window check for maintenance
  if (announcement.type === 'maintenance' && announcement.startTime && announcement.endTime) {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startH, startM] = announcement.startTime.split(':').map(Number)
    const [endH, endM] = announcement.endTime.split(':').map(Number)
    
    if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      let inWindow = false
      if (startMinutes <= endMinutes) {
        inWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes
      } else {
        // Cross-midnight window e.g. 23:00 to 03:00
        inWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes
      }

      if (inWindow) {
        return {
          isPaused: true,
          reason: `Services are currently paused for scheduled maintenance (${announcement.startTime} – ${announcement.endTime}).`
        }
      }
    }
  }

  return { isPaused: false }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
  return match ? decodeURIComponent(match[3]) : null
}

let inMemoryCache: { data: SystemAnnouncement; timestamp: number } | null = null
const CACHE_TTL_MS = 60000 // 60 seconds

export async function fetchSystemAnnouncement(forceRefresh = false): Promise<SystemAnnouncement> {
  const now = Date.now()
  if (!forceRefresh && inMemoryCache && (now - inMemoryCache.timestamp < CACHE_TTL_MS)) {
    return inMemoryCache.data
  }

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'announcement')
      .maybeSingle()

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      const merged = { ...DEFAULT_ANNOUNCEMENT, ...parsed }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      inMemoryCache = { data: merged, timestamp: now }
      return merged
    }
  } catch (err) {
    console.warn('System settings fetch warning:', err)
  }

  // 2. Try shared localhost cookie (synced from admin port 3001)
  try {
    const cookieVal = getCookie(STORAGE_KEY)
    if (cookieVal) {
      const parsed = JSON.parse(cookieVal)
      const merged = { ...DEFAULT_ANNOUNCEMENT, ...parsed }
      inMemoryCache = { data: merged, timestamp: now }
      return merged
    }
  } catch {}

  // 3. Fallback to localStorage
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const merged = { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(cached) }
      inMemoryCache = { data: merged, timestamp: now }
      return merged
    }
  } catch {}

  inMemoryCache = { data: DEFAULT_ANNOUNCEMENT, timestamp: now }
  return DEFAULT_ANNOUNCEMENT
}

export function updateLocalAnnouncementCache(data: SystemAnnouncement) {
  inMemoryCache = { data, timestamp: Date.now() }
}

let featuresMemoryCache: { data: PlatformFeatures; timestamp: number } | null = null

export async function fetchPlatformFeatures(forceRefresh = false): Promise<PlatformFeatures> {
  const now = Date.now()
  if (!forceRefresh && featuresMemoryCache && (now - featuresMemoryCache.timestamp < CACHE_TTL_MS)) {
    return featuresMemoryCache.data
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'platform_features')
      .maybeSingle()

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      const merged = { ...DEFAULT_PLATFORM_FEATURES, ...parsed }
      localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(merged))
      featuresMemoryCache = { data: merged, timestamp: now }
      return merged
    }
  } catch (err) {
    console.warn('Features fetch warning:', err)
  }

  // Fallback to local storage
  try {
    const cached = localStorage.getItem(FEATURES_STORAGE_KEY)
    if (cached) {
      const merged = { ...DEFAULT_PLATFORM_FEATURES, ...JSON.parse(cached) }
      featuresMemoryCache = { data: merged, timestamp: now }
      return merged
    }
  } catch {}

  featuresMemoryCache = { data: DEFAULT_PLATFORM_FEATURES, timestamp: now }
  return DEFAULT_PLATFORM_FEATURES
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', PAYMENT_SETTINGS_KEY)
      .maybeSingle()
      
    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      return { ...DEFAULT_PAYMENT_SETTINGS, ...parsed }
    }
  } catch (err) {
    console.warn('Payment settings fetch error:', err)
  }
  return DEFAULT_PAYMENT_SETTINGS
}
