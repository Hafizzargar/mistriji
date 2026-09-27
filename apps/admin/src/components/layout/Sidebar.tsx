import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  LayoutDashboard, Users, Briefcase, Wrench,
  Settings, ClipboardList, ShieldCheck, X, MessageCircle, Bell, CreditCard, Bug
} from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  superAdminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard',       icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/workers',         icon: <Users size={18} />,           label: 'Workers' },
  { to: '/jobs',            icon: <Briefcase size={18} />,       label: 'Jobs' },
  { to: '/customers',       icon: <ClipboardList size={18} />,   label: 'Customers' },
  { to: '/payments',        icon: <CreditCard size={18} />,      label: 'Payments' },
  { to: '/support',         icon: <MessageCircle size={18} />,   label: 'Support Inbox' },
  { to: '/notifications',   icon: <Bell size={18} />,            label: 'Notifications' },
  { to: '/skills',          icon: <Wrench size={18} />,          label: 'Services' },
  { to: '/admins',          icon: <ShieldCheck size={18} />,     label: 'Admins', superAdminOnly: true },
  { to: '/errors',          icon: <Bug size={18} />,             label: 'Error Center', superAdminOnly: true },
  { to: '/settings',        icon: <Settings size={18} />,        label: 'Settings', superAdminOnly: true },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const visibleItems = navItems.filter(
    item => !item.superAdminOnly || user?.role === 'super_admin'
  )

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Sidebar Header with Logo & Close button on mobile */}
      <div className="admin-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={styles.logoIcon}>🔧</div>
          <div>
            <div style={styles.logoName}>MistriJi</div>
            <div style={styles.logoSub}>Admin Panel</div>
          </div>
        </div>

        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="admin-sidebar-close-btn"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => onClose?.()}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  logoIcon: {
    width: 38,
    height: 38,
    background: 'var(--brand-500)',
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    flexShrink: 0,
    color: '#fff',
  },
  logoName: {
    fontWeight: 800,
    fontSize: '1.05rem',
    color: 'var(--gray-900)',
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: '0.675rem',
    color: 'var(--gray-400)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'var(--brand-50)',
    margin: '0.75rem',
    borderRadius: '0.625rem',
  },
  userAvatar: {
    width: 34,
    height: 34,
    background: 'var(--brand-500)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  userName: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--gray-800)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--brand-600)',
    fontWeight: 600,
  },
  nav: {
    flex: 1,
    padding: '0.25rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.6rem',
    borderRadius: '0.375rem',
    color: 'var(--gray-600)',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'background 150ms ease, color 150ms ease',
    textDecoration: 'none',
  },
  navItemActive: {
    background: 'var(--brand-50)',
    color: 'var(--brand-600)',
    fontWeight: 700,
  },
}
