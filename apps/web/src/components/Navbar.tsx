import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Wrench,
  MapPin,
  Calendar,
  HardHat,
  LogIn,
  LogOut,
  User,
  Zap,
  Hammer,
  Sparkles,
  Paintbrush,
  Flame,
  ShieldCheck,
  Edit3,
  Settings,
  Menu,
  MessageCircle
} from 'lucide-react'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { useToast } from '@/contexts/ToastContext'
import { WorkerAuthModal } from '@/components/WorkerAuthModal'
import { UserProfileModal } from '@/components/UserProfileModal'
import { RoleSelectionModal } from '@/components/RoleSelectionModal'
import { SupportChatModal } from '@/components/SupportChatModal'
import { NotificationBell } from './NotificationBell'

export function Navbar({ currentArea }: { currentArea: string }) {
  const location = useLocation()
  const { customer, isLoggedIn, logout, openRoleModal, openProfileModal } = useCustomerAuth()
  const toast = useToast()
  const [showWorkerModal, setShowWorkerModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isLoggedIn || !customer?.id) {
      setUnreadChatCount(0)
      return
    }
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', customer.id)
        .eq('sender', 'admin')
        .eq('is_read', false)
      setUnreadChatCount(count || 0)
    }
    
    fetchUnread()
    
    const channel = supabase.channel('user_chat_nav')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${customer.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `user_id=eq.${customer.id}` }, fetchUnread)
      .subscribe()
      
    return () => { supabase.removeChannel(channel) }
  }, [isLoggedIn, customer?.id])

  React.useEffect(() => {
    const handleOpenWorker = () => setShowWorkerModal(true);
    const handleOpenSupport = () => setIsSupportOpen(true);
    window.addEventListener('open-worker-register', handleOpenWorker as EventListener);
    window.addEventListener('open-support-chat', handleOpenSupport as EventListener);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      window.removeEventListener('open-worker-register', handleOpenWorker as EventListener);
      window.removeEventListener('open-support-chat', handleOpenSupport as EventListener);
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, []);

  const handleLogout = () => {
    logout()
    toast.info('You have been logged out successfully.')
  }

  return (
    <>
      <header className="navbar-header">
        <div className="navbar-container">
          {/* Brand Logo */}
          <Link to="/" className="navbar-brand">
            <div className="navbar-logo-icon">
              <Wrench size={18} />
            </div>
            <div>
              <div className="navbar-brand-title">
                Mistri<span style={{ color: '#818cf8' }}>Ji</span>
              </div>
              <div className="navbar-brand-subtitle">
                JAMMU LOCAL WORKERS
              </div>
            </div>
          </Link>

          {/* Current Location Badge */}
          <div className="navbar-location-badge" title={`Current Area: ${currentArea}, J&K`}>
            <MapPin size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span className="navbar-location-text">{currentArea}, J&K</span>
          </div>

          {/* Navigation Actions */}
          <nav className="navbar-nav">
            {/* My Bookings Link (Hidden for workers) */}
            {(!isLoggedIn || customer?.role !== 'worker') && (
              <Link
                to="/my-bookings"
                className={`navbar-link ${location.pathname === '/my-bookings' ? 'active' : ''}`}
                title="Track your service requests"
              >
                <Calendar size={14} />
                <span className="navbar-link-text">My Bookings</span>
              </Link>
            )}

            {/* Worker Dashboard Link */}
            {isLoggedIn && customer?.role === 'worker' && (
              <Link
                to="/worker"
                className={`navbar-link ${location.pathname === '/worker' ? 'active' : ''}`}
                title="Worker Dashboard"
                style={{ background: location.pathname === '/worker' ? 'rgba(16, 185, 129, 0.15)' : undefined }}
              >
                <HardHat size={14} style={{ color: '#10b981' }} />
                <span className="navbar-link-text">My Jobs</span>
              </Link>
            )}

            {/* Join as Worker Link (Visible for Guests) */}
            {!isLoggedIn && (
              <button
                type="button"
                onClick={openRoleModal}
                className="navbar-link"
                style={{ background: 'rgba(79, 70, 229, 0.1)', cursor: 'pointer', padding: '0.5rem 1rem' }}
                title="Login or Register"
              >
                <User size={14} style={{ color: '#4f46e5' }} />
                <span className="navbar-link-text" style={{ color: '#4f46e5', fontWeight: 700 }}>Login / Register</span>
              </button>
            )}

            {isLoggedIn && <NotificationBell />}

            {/* Menu Dropdown Container (Visible only for logged in users) */}
            {isLoggedIn && (
              <div style={{ position: 'relative' }} ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="navbar-user-badge"
                  style={{ cursor: 'pointer', padding: '0.25rem' }}
                  title="Menu"
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: customer?.role === 'worker' ? '#10b981' : '#4f46e5',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    {customer?.name?.[0] || (customer?.role === 'worker' ? 'W' : 'C')}
                  </div>
                </button>

                {/* Dropdown Menu Box */}
                {isMenuOpen && (
                  <div className="navbar-dropdown-menu">
                    <div className="navbar-dropdown-header">
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' }}>
                        {customer?.name || 'User'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
                        {customer?.phone}
                      </div>
                    </div>
                    
                    {(customer?.role === 'admin' || customer?.role === 'super_admin') && (
                      <Link to="/admin/dispatch" className="navbar-dropdown-item" onClick={() => setIsMenuOpen(false)}>
                        <Settings size={14} style={{ color: '#fbbf24' }} /> Dispatch Panel
                      </Link>
                    )}

                    {customer?.role === 'worker' && (
                      <Link to="/worker" className="navbar-dropdown-item" onClick={() => setIsMenuOpen(false)}>
                        <HardHat size={14} style={{ color: '#10b981' }} /> My Jobs Dashboard
                      </Link>
                    )}
                    
                    <button onClick={() => { setIsMenuOpen(false); openProfileModal(); }} className="navbar-dropdown-item">
                      <User size={14} style={{ color: '#818cf8' }} /> Edit Profile
                    </button>
                    
                    <button onClick={() => { setIsMenuOpen(false); setIsSupportOpen(true); }} className="navbar-dropdown-item" style={{ position: 'relative' }}>
                      <MessageCircle size={14} style={{ color: '#38bdf8' }} /> Support Chat
                      {unreadChatCount > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto' }}>
                          {unreadChatCount} New
                        </span>
                      )}
                    </button>
                    
                    <div className="navbar-dropdown-divider" />
                    
                    <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="navbar-dropdown-item" style={{ color: '#fca5a5' }}>
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* User Profile Edit Modal */}
      <UserProfileModal />

      {/* Role Selection Modal */}
      <RoleSelectionModal />

      {/* Worker Registration & Login Modal */}
      <WorkerAuthModal
        isOpen={showWorkerModal}
        onClose={() => setShowWorkerModal(false)}
      />

      {/* Support Chat Modal */}
      <SupportChatModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </>
  )
}
