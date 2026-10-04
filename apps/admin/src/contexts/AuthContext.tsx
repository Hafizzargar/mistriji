import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AUTH_API_BASE } from '../lib/authApi'

export interface AuthUser {
  id: string
  phone: string | null
  email: string | null
  role: 'admin' | 'super_admin'
  name: string
  status?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  setSession: (accessToken: string, user: AuthUser) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  setSession: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef<AuthUser | null>(null)
  userRef.current = user

  async function purgeSession(reason?: string) {
    setUser(null)
    userRef.current = null
    try {
      await fetch(`${AUTH_API_BASE}/api/otp/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Logout error:', err)
    }
    if (reason && window.location.pathname !== '/login') {
      window.location.href = `/login?reason=${encodeURIComponent(reason)}`
    }
  }

  function setSession(accessToken: string, authUser: AuthUser) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: '' })
    setUser(authUser)
    setLoading(false)
  }

  async function loadInitialSession() {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/otp/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' 
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.session && data.session.access_token) {
          setSession(data.session.access_token, data.session.user)
          return
        }
      }
    } catch (err) {
      console.error('Failed to load initial session:', err)
    }
    
    // If we reach here, no valid session
    setUser(null)
    setLoading(false)
  }

  useEffect(() => {
    loadInitialSession()
  }, [])

  useEffect(() => {
    if (!user) return

    // --- Inactivity Timeout Logic (15 minutes) ---
    let timeoutId: ReturnType<typeof setTimeout>
    let warningTimeoutId: ReturnType<typeof setTimeout>

    const handleInactivityLogout = () => {
      console.warn('Admin logged out due to inactivity.')
      purgeSession('inactivity_timeout')
    }

    const handleInactivityWarning = () => {
      console.warn('Admin session will expire in 2 minutes due to inactivity.')
      // Dispatch a custom event in case a global listener (like Toast) wants to show it
      window.dispatchEvent(new CustomEvent('auth-warning', { 
        detail: 'You will be logged out in 2 minutes due to inactivity. Move your mouse or type to stay logged in.' 
      }))
    }

    const resetTimers = () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      // 15 mins total (900000ms), warn at 13 mins (780000ms)
      timeoutId = setTimeout(handleInactivityLogout, 900000)
      warningTimeoutId = setTimeout(handleInactivityWarning, 780000)
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach(e => document.addEventListener(e, resetTimers, { capture: true, passive: true }))
    
    // Initial start
    resetTimers()

    // Realtime postgres changes channel on 'users' table
    const channel = supabase
      .channel('admin-auth-live-guard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload: any) => {
          const current = userRef.current
          if (!current) return

          if (payload.eventType === 'DELETE' && payload.old?.id === current.id) {
            console.warn('Current admin account was deleted! Forcing immediate logout...')
            purgeSession('account_deleted')
          }

          if (payload.eventType === 'UPDATE' && payload.new?.id === current.id) {
            const newStatus = String(payload.new.status || '').toLowerCase()
            const newRole = payload.new.role

            if (newStatus === 'suspended' || newStatus === 'disabled' || newStatus === 'deleted' || (newRole !== 'admin' && newRole !== 'super_admin')) {
              console.warn('Current admin account was suspended or demoted! Forcing immediate logout...')
              purgeSession('account_suspended')
            }
          }
        }
      )
      .subscribe()

    return () => {
      activityEvents.forEach(e => document.removeEventListener(e, resetTimers, { capture: true }))
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      supabase.removeChannel(channel)
    }
  }, [user])

  async function signOut() {
    await purgeSession()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
