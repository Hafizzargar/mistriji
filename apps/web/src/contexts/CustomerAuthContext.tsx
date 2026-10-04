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

export type LoginResult =
  | { ok: true; isNewUser?: boolean }
  | { ok: false; error: string; isSuspended?: boolean }

interface CustomerAuthContextType {
  customer: CustomerUser | null
  isLoggedIn: boolean
  checkUserStatus: (identifier: string) => Promise<CheckUserStatusResult>
  login: (identifier: string, name?: string) => Promise<LoginResult>
  logout: (customMessage?: string) => void
  updateProfile: (payload: UpdateProfilePayload) => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
  showLoginModal: boolean
  openLoginModal: () => void
  closeLoginModal: () => void
  showRoleModal: boolean
  openRoleModal: () => void
  closeRoleModal: () => void
  suspendedAlert: string | null
  clearSuspendedAlert: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null)

const SESSION_KEY = 'mistriji_customer'

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Legacy support: if session is a guest, ignore it and force login
        if (parsed?.id?.startsWith('guest-')) {
          localStorage.removeItem(SESSION_KEY)
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
    localStorage.removeItem(SESSION_KEY)
    if (customMessage) {
      setSuspendedAlert(customMessage)
      // We do not reload or manually redirect here. 
      // setCustomer(null) above causes isLoggedIn to become false,
      // which triggers <Navigate to="/" replace /> in WorkerLayout/CustomerLayout.
    } else {
      // Always redirect to the main page on normal logout
      window.location.href = '/'
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

      // REAL-TIME AUTO-LOGOUT IF SUSPENDED/DISABLED/DEACTIVATED BY ADMIN
      // Super Admin is NEVER suspended — always exempt
      const isSuperAdmin = userData.role === 'super_admin'
      const BLOCKED_RT_STATUSES = new Set(['suspended', 'disabled', 'deactivated'])
      if (!isSuperAdmin && BLOCKED_RT_STATUSES.has((userData.status || '').toLowerCase())) {
        const photo = (userData.profiles as any)?.photo_url
        const reason = photo && photo.startsWith('suspension_reason:')
          ? photo.replace('suspension_reason:', '')
          : 'Account suspended by administration.'

        logout(JSON.stringify({
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          message: `Your account has been suspended. Reason: "${reason}"`,
          supportEmail: 'support@mistriji.in',
          supportPhone: '+91 9419000000'
        }))
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
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
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

      // 4. Polling fallback (in case Supabase Realtime is not enabled)
      // 60 seconds is sufficient — Realtime handles instant kicks; this is just a safety net
      const pollInterval = setInterval(() => {
        refreshProfile(currentId)
      }, 60_000)

      return () => {
        supabase.removeChannel(channel)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(pollInterval)
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

      // Do NOT expose isSuperAdmin to prevent user-enumeration attacks.
      // We will handle the admin redirect AFTER they successfully verify the OTP.
      if (user.role === 'super_admin' || user.role === 'admin') {
        return { exists: true, isSuperAdmin: false, role: 'customer' } // Mask as regular customer
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
      // Fail closed — if we can't verify status, don't allow login
      return { exists: true, isSuspended: true, suspensionReason: 'Unable to verify account status. Please try again.' }
    }
  }, [])

  const login = useCallback(async (identifier: string, name?: string): Promise<LoginResult> => {
    if (!identifier) {
      return { ok: false, error: 'Enter a valid mobile number or email' }
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
        return { ok: false, error: 'Enter a valid 10-digit mobile number' }
      }
      query = query.or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.%${cleanPhone}%`)
    }

    const { data: usersList, error: queryError } = await query

    // Fail-closed: if query fails, NEVER create an account or grant access
    if (queryError) {
      console.error('[CustomerAuth] DB query error in login:', queryError.message)
      return { ok: false, error: 'Unable to verify account status. Please try again.' }
    }

    const existing = usersList?.find((u: any) => u.role === 'super_admin' || u.role === 'admin') ||
                     usersList?.find((u: any) => u.role === 'customer') ||
                     usersList?.[0]

    // Security Check: Block Super Admin / Admin from logging in via Customer App
    const ADMIN_ROLES = ['super_admin', 'admin']
    if (existing && ADMIN_ROLES.includes(existing.role)) {
      console.warn('[CustomerAuth] Blocked admin login attempt via customer portal:', identifier)
      return { 
        ok: false,
        error: '🔐 This account belongs to an Administrator. Please use the Admin Portal.',
      }
    }
    // Security Check: Block Suspended/Disabled/Deactivated users — all statuses in one set
    const BLOCKED_STATUSES = new Set(['suspended', 'disabled', 'deactivated'])
    if (existing && BLOCKED_STATUSES.has((existing.status || '').toLowerCase())) {
      const photo = (existing.profiles as any)?.photo_url
      const reason = photo && photo.startsWith('suspension_reason:')
        ? photo.replace('suspension_reason:', '')
        : 'Violation of community policies or repeated booking issues.'

      return {
        ok: false,
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
        return { ok: false, error: 'Failed to create account. This number might already be registered to a Mistri Partner or Admin.' }
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
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    setShowLoginModal(false)
    return { ok: true, isNewUser: !existing }
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser))

      return { success: true }
    } catch (err: any) {
      console.error('Update profile error:', err)
      return { success: false, error: err.message || 'Failed to update profile' }
    }
  }, [customer, logout])

  const openLoginModal = useCallback(() => setShowLoginModal(true), [])
  const closeLoginModal = useCallback(() => setShowLoginModal(false), [])



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
