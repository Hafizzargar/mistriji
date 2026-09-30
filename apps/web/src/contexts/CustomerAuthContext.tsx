import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveJammuInput } from '@/lib/jammuCoordinates'

export interface CustomerUser {
  id: string
  phone: string
  email?: string
  name?: string
  role?: string
  status?: string
  suspension_reason?: string
  area?: string
  city?: string
  address?: string
  photo_url?: string
  experience_years?: number
  is_available?: boolean
  verification_status?: string
  jobs_accepted?: number
  jobs_rejected?: number
}

interface UpdateProfilePayload {
  name: string
  area?: string
  city?: string
  address?: string
  photo_url?: string
  experience_years?: number
  is_available?: boolean
  phone?: string
  email?: string
}

export interface CheckUserStatusResult {
  exists: boolean
  isSuperAdmin?: boolean
  isSuspended?: boolean
  suspensionReason?: string
  name?: string
  role?: string
}

interface CustomerAuthContextType {
  customer: CustomerUser | null
  isLoggedIn: boolean
  checkUserStatus: (identifier: string) => Promise<CheckUserStatusResult>
  login: (identifier: string, name?: string) => Promise<{ error?: string; isNewUser?: boolean; isSuspended?: boolean }>
  logout: (customMessage?: string) => void
  updateProfile: (payload: UpdateProfilePayload) => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
  showLoginModal: boolean
  openLoginModal: () => void
  closeLoginModal: () => void
  showRoleModal: boolean
  openRoleModal: () => void
  closeRoleModal: () => void
  showProfileModal: boolean
  openProfileModal: () => void
  closeProfileModal: () => void
  suspendedAlert: string | null
  clearSuspendedAlert: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null)

const SESSION_KEY = 'mistriji_customer'

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Legacy support: if session is a guest, ignore it and force login
        if (parsed?.id?.startsWith('guest-')) {
          sessionStorage.removeItem(SESSION_KEY)
          return null
        }
        return parsed
      }
      return null
    } catch {
      return null
    }
  })
  const [showLoginModal, setShowLoginModal]     = useState(false)
  const [showRoleModal, setShowRoleModal]       = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [suspendedAlert, setSuspendedAlert]     = useState<string | null>(null)

  const isLoggedIn = !!customer

  // Real-time user presence tracking
  useEffect(() => {
    if (!customer?.id || customer.id.startsWith('guest-')) return

    const presenceChannel = supabase.channel('global_user_presence', {
      config: {
        presence: {
          key: customer.id,
        },
      },
    })

    presenceChannel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        presenceChannel.track({
          user_id: customer.id,
          role: customer.role || 'customer',
          online_at: new Date().toISOString(),
        })
      }
    })

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [customer?.id, customer?.role])

  const logout = useCallback((customMessage?: string) => {
    setCustomer(null)
    sessionStorage.removeItem(SESSION_KEY)
    setShowProfileModal(false)
    if (customMessage) {
      setSuspendedAlert(customMessage)
    }
  }, [])

  const clearSuspendedAlert = useCallback(() => setSuspendedAlert(null), [])

  // Refresh profile from Supabase & verify real-time active status
  const refreshProfile = useCallback(async (userId?: string) => {
    const idToFetch = userId || customer?.id
    if (!idToFetch || idToFetch.startsWith('guest-')) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, phone, email, role, status,
          profiles (name, area, city, photo_url),
          worker_profiles (experience_years, is_available, verification_status)
        `)
        .eq('id', idToFetch)
        .maybeSingle()

      if (error || !data) return

      const userData: any = data

      // REAL-TIME AUTO-LOGOUT IF SUSPENDED BY ADMIN
      if (userData.status === 'suspended' || userData.status === 'disabled') {
        const photo = (userData.profiles as any)?.photo_url
        const reason = photo && photo.startsWith('suspension_reason:')
          ? photo.replace('suspension_reason:', '')
          : 'Account suspended by administration.'
        logout(`⛔ Your account has been suspended by administration. Reason: "${reason}". Please connect with MistriJi Support (+91 9419000000 / support@mistriji.in).`)
        return
      }

      const prof = (userData.profiles as any) || {}
      const wrk  = (userData.worker_profiles as any) || {}
      const rawPhoto = prof.photo_url
      const validPhoto = rawPhoto && !rawPhoto.startsWith('suspension_reason:') ? rawPhoto : null

      setCustomer(prev => {
        if (!prev) return prev
        const updated: CustomerUser = {
          id: userData.id,
          phone: userData.phone || '',
          email: userData.email || '',
          role: userData.role,
          status: userData.status,
          name: prof.name || prev.name || `User ${userData.phone.slice(-4)}`,
          area: prof.area || prev.area || 'Gandhi Nagar',
          city: prof.city || prev.city || 'Jammu',
          photo_url: validPhoto || prev.photo_url,
          experience_years: wrk.experience_years,
          is_available: wrk.is_available,
          verification_status: wrk.verification_status,
        }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      console.warn('Could not refresh profile:', err)
    }
  }, [customer?.id, logout])

  // Initial check & real-time subscription to catch admin suspensions immediately
  useEffect(() => {
    const currentId = customer?.id
    if (currentId) {
      // 1. Initial fetch
      refreshProfile(currentId)

      // 2. Supabase Realtime Subscription (Most efficient)
      const channel = supabase
        .channel(`public:users:id=eq.${currentId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentId}` },
          () => refreshProfile(currentId)
        )
        .subscribe()

      // 3. Fallback: check when user returns to the tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          refreshProfile(currentId)
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        supabase.removeChannel(channel)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  const checkUserStatus = useCallback(async (identifier: string): Promise<CheckUserStatusResult> => {
    if (!identifier) {
      return { exists: false }
    }

    const isEmail = identifier.includes('@')
    try {
      let query = supabase
        .from('users')
        .select(`
          id, phone, email, role, status,
          profiles (name, area, city, photo_url)
        `)
        
      if (isEmail) {
        query = query.eq('email', identifier)
      } else {
        const cleanPhone = identifier.replace(/\D/g, '').slice(-10)
        if (cleanPhone.length < 10) return { exists: false }
        query = query.or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.%${cleanPhone}%`)
      }

      const { data, error } = await query

      if (error || !data || data.length === 0) {
        return { exists: false }
      }

      const usersList: any = data
      const user = usersList.find((u: any) => u.role === 'super_admin' || u.role === 'admin') ||
                   usersList.find((u: any) => u.role === 'customer') ||
                   usersList[0]

      if (user.role === 'super_admin' || user.role === 'admin') {
        return { exists: true, isSuperAdmin: true, role: user.role }
      }

      // Check if user is suspended
      if (user.status === 'suspended' || user.status === 'disabled') {
        const photo = (user.profiles as any)?.photo_url
        const reason = photo && photo.startsWith('suspension_reason:')
          ? photo.replace('suspension_reason:', '')
          : 'Account under administrative review / terms violation'

        return {
          exists: true,
          isSuspended: true,
          suspensionReason: reason,
          name: (user.profiles as any)?.name || 'User',
          role: user.role,
        }
      }

      const profileName = (user.profiles as any)?.name || ''
      return { exists: true, isSuperAdmin: false, isSuspended: false, name: profileName, role: user.role }
    } catch (err) {
      return { exists: false }
    }
  }, [])

  const login = useCallback(async (identifier: string, name?: string): Promise<{ error?: string; isNewUser?: boolean; isSuspended?: boolean }> => {
    if (!identifier) {
      return { error: 'Enter a valid mobile number or email' }
    }

    const isEmail = identifier.includes('@')
    let cleanPhone = ''
    
    let query = supabase
      .from('users')
      .select(`
        id, phone, email, role, status, 
        profiles (name, area, city, photo_url),
        worker_profiles (experience_years, is_available, verification_status)
      `)

    if (isEmail) {
      query = query.eq('email', identifier)
    } else {
      cleanPhone = identifier.replace(/\D/g, '').slice(-10)
      if (cleanPhone.length < 10) {
        return { error: 'Enter a valid 10-digit mobile number' }
      }
      query = query.or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.%${cleanPhone}%`)
    }

    const { data: usersList } = await query

    const existing = usersList?.find((u: any) => u.role === 'super_admin' || u.role === 'admin') ||
                     usersList?.find((u: any) => u.role === 'customer') ||
                     usersList?.[0]


    // Security Check: Block Suspended users with reason & support message
    if (existing && (existing.status === 'suspended' || existing.status === 'disabled')) {
      const photo = (existing.profiles as any)?.photo_url
      const reason = photo && photo.startsWith('suspension_reason:')
        ? photo.replace('suspension_reason:', '')
        : 'Violation of community policies or repeated booking issues.'

      return {
        isSuspended: true,
        error: `⛔ Your account has been suspended by administration.\n\nReason: "${reason}"\n\nPlease connect with MistriJi Support (+91 9419000000 / support@mistriji.in) to appeal or restore your account.`
      }
    }

    let userId: string
    let resolvedName = name?.trim() || ''
    let resolvedArea = 'Gandhi Nagar'
    let resolvedCity = 'Jammu'

    if (existing) {
      userId = existing.id
      const p = (existing.profiles as any) || {}
      resolvedName = p.name || resolvedName || `Customer ${isEmail ? identifier.split('@')[0] : cleanPhone.slice(-4)}`
      resolvedArea = p.area || resolvedArea
      resolvedCity = p.city || resolvedCity
      
      // Update email for existing customer if missing
      if (!existing.email) {
        await supabase.from('users').update({ email: isEmail ? identifier : `guest-${cleanPhone}@mistriji.local` }).eq('id', userId)
      }
    } else {
      // Create new customer
      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({ 
          phone: isEmail ? String(Math.floor(1000000000 + Math.random() * 9000000000)) : cleanPhone, 
          role: 'customer', 
          status: 'active',
          email: isEmail ? identifier : `guest-${cleanPhone}@mistriji.local`
        })
        .select('id')
        .single()

      if (createErr) {
        console.warn('Customer create fallback:', createErr.message)
        return { error: 'Failed to create account. This number might already be registered to a Mistri Partner or Admin.' }
      } else {
        userId = newUser.id
        resolvedName = resolvedName || `Customer ${isEmail ? identifier.split('@')[0] : cleanPhone.slice(-4)}`
        const locationMeta = resolveJammuInput(resolvedArea)
        await supabase.from('profiles').upsert({
          user_id: userId,
          name: resolvedName,
          area: resolvedArea,
          city: resolvedCity,
        }).select().maybeSingle()
      }
    }

    const user: CustomerUser = {
      id: userId,
      phone: existing?.phone || cleanPhone || '',
      email: existing?.email || identifier || '',
      name: resolvedName,
      role: existing?.role || 'customer',
      status: existing?.status || 'active',
      area: resolvedArea,
      city: resolvedCity,
    }
    setCustomer(user)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    setShowLoginModal(false)
    return { isNewUser: !existing }
  }, [])

  const updateProfile = useCallback(async (payload: UpdateProfilePayload): Promise<{ success: boolean; error?: string }> => {
    if (!customer) return { success: false, error: 'Not logged in' }

    try {
      const cleanName = payload.name.trim()
      if (!cleanName) return { success: false, error: 'Name cannot be empty' }

      // Check active status
      if (customer.id && !customer.id.startsWith('guest-')) {
        const { data: userCheck } = await supabase.from('users').select('status').eq('id', customer.id).maybeSingle()
        if (userCheck && (userCheck.status === 'suspended' || userCheck.status === 'disabled')) {
          logout('⛔ Your account has been suspended by administration.')
          return { success: false, error: 'Account is suspended.' }
        }

        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({
            user_id: customer.id,
            name: cleanName,
            area: payload.area ?? customer.area ?? 'Gandhi Nagar',
            city: payload.city ?? customer.city ?? 'Jammu',
            photo_url: payload.photo_url ?? customer.photo_url ?? null,
          })

        if (profileErr) throw profileErr

        if (customer.role === 'worker' && (payload.experience_years !== undefined || payload.is_available !== undefined)) {
          const updateWorkerData: Record<string, any> = {}
          if (payload.experience_years !== undefined) updateWorkerData.experience_years = payload.experience_years
          if (payload.is_available !== undefined) updateWorkerData.is_available = payload.is_available

          await supabase
            .from('worker_profiles')
            .update(updateWorkerData)
            .eq('user_id', customer.id)
        }

        // Only update email/phone if they are currently MISSING for this user
        const userUpdates: Record<string, any> = {}
        if (payload.phone && !customer.phone) {
          userUpdates.phone = payload.phone.replace(/\D/g, '').slice(-10)
        }
        if (payload.email && (!customer.email || customer.email.includes('@mistriji.local') || customer.email === 'hafezzargar987+cu@gmail.com')) {
          userUpdates.email = payload.email
        }
        
        if (Object.keys(userUpdates).length > 0) {
          const { error: userErr } = await supabase
            .from('users')
            .update(userUpdates)
            .eq('id', customer.id)
            
          if (userErr) throw userErr
        }
      }

      const updatedUser: CustomerUser = {
        ...customer,
        name: cleanName,
        area: payload.area ?? customer.area ?? 'Gandhi Nagar',
        city: payload.city ?? customer.city ?? 'Jammu',
        photo_url: payload.photo_url ?? customer.photo_url,
        experience_years: payload.experience_years ?? customer.experience_years,
        is_available: payload.is_available ?? customer.is_available,
        phone: (payload.phone && !customer.phone) ? payload.phone.replace(/\D/g, '').slice(-10) : customer.phone,
        email: (payload.email && (!customer.email || customer.email.includes('@mistriji.local') || customer.email === 'hafezzargar987+cu@gmail.com')) ? payload.email : customer.email,
      }

      setCustomer(updatedUser)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser))

      return { success: true }
    } catch (err: any) {
      console.error('Update profile error:', err)
      return { success: false, error: err.message || 'Failed to update profile' }
    }
  }, [customer, logout])

  const openLoginModal = useCallback(() => setShowLoginModal(true), [])
  const closeLoginModal = useCallback(() => setShowLoginModal(false), [])

  const openProfileModal = useCallback(() => setShowProfileModal(true), [])
  const closeProfileModal = useCallback(() => setShowProfileModal(false), [])

  return (
    <CustomerAuthContext.Provider value={{
      customer,
      isLoggedIn,
      checkUserStatus,
      login,
      logout,
      updateProfile,
      refreshProfile,
      showLoginModal,
      openLoginModal,
      closeLoginModal,
      showRoleModal,
      openRoleModal: () => setShowRoleModal(true),
      closeRoleModal: () => setShowRoleModal(false),
      showProfileModal,
      openProfileModal,
      closeProfileModal,
      suspendedAlert,
      clearSuspendedAlert,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be inside CustomerAuthProvider')
  return ctx
}
