import React, { useState } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Sidebar } from './Sidebar'
import { Menu, X, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react'
import { NotificationBell } from '../NotificationBell'

export function AdminLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { signOut } = useAuth()
  const toast = useToast()

  const handleSignOut = async () => {
    await signOut()
    toast.info('You have been logged out successfully.')
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingIcon}>🔧</div>
          <div className="spinner" style={{ color: 'var(--brand-500)', width: 28, height: 28 }} />
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Loading MistriJi Admin…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />

  const isSubpage = location.pathname !== '/dashboard' && location.pathname !== '/'

  return (
    <div className="admin-shell">
      {/* Mobile Top Header */}
      <header className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Quick back button on subpages */}
          {isSubpage && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: 'var(--gray-100)',
                border: '1px solid var(--gray-200)',
                color: 'var(--gray-700)',
                width: 34,
                height: 34,
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Go Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div style={{
            width: 34,
            height: 34,
            background: 'var(--brand-500)',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}>
            🔧
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--gray-900)', lineHeight: 1.1 }}>
              MistriJi <span style={{ color: 'var(--brand-600)' }}>Admin</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--brand-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {user.role === 'super_admin' ? '⭐ Super Admin' : 'Admin'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationBell />
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.4rem', borderRadius: '0.5rem',
            border: 'none', background: 'var(--gray-100)',
            color: 'var(--gray-700)', cursor: 'pointer'
          }}>
            <LogOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="admin-menu-toggle-btn"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop fixed left / Mobile slide-over drawer) */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Desktop Top Bar */}
        <div className="admin-desktop-topbar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0.875rem 1.75rem',
          borderBottom: '1px solid var(--gray-200)',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          gap: '1rem',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          {/* User Profile Badge (Moved from sidebar to top header) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.35rem 0.85rem 0.35rem 0.45rem',
            borderRadius: '9999px',
            background: 'var(--brand-50)',
            border: '1px solid var(--brand-100)',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>
              {user.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-900)', lineHeight: 1.1 }}>
                {user.name || 'Admin'}
              </div>
              <div style={{ fontSize: '0.68rem', color: user.role === 'super_admin' ? '#d97706' : 'var(--brand-600)', fontWeight: 700, marginTop: '1px' }}>
                {user.role === 'super_admin' ? '⭐ Super Admin' : 'Admin'}
              </div>
            </div>
          </div>

          <NotificationBell />
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: '0.5rem',
            border: '1px solid var(--gray-200)', background: '#fff',
            color: 'var(--gray-600)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
          }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gray-50)',
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  loadingIcon: {
    fontSize: '2.5rem',
  },
}
