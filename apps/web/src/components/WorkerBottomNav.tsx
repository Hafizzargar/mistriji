import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Briefcase, Bell, User } from 'lucide-react'

export function WorkerBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  const isDashboard = path === '/worker/dashboard' || path === '/worker'
  const isNotifications = path.startsWith('/worker/notifications')
  const isProfile = path.startsWith('/worker/profile')

  return (
    <>
      <style>{`
        .worker-mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(15, 20, 50, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.45rem 0 calc(0.45rem + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
        }
        .worker-mobile-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 500px;
          margin: 0 auto;
        }
        .worker-mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 0.35rem 0.75rem;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: all 0.2s ease;
          border-radius: 8px;
        }
        .worker-mobile-nav-item:active {
          transform: scale(0.94);
        }
        .worker-mobile-nav-item.active {
          color: #f97316;
        }
        .worker-mobile-nav-item.active svg {
          filter: drop-shadow(0 0 6px rgba(249, 115, 22, 0.6));
        }
        @media (max-width: 768px) {
          .worker-mobile-bottom-nav {
            display: block;
          }
          .worker-layout-content {
            padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
        @media (min-width: 769px) {
          .worker-mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
      <nav className="worker-mobile-bottom-nav" aria-label="Worker Navigation">
        <div className="worker-mobile-nav-inner">
          <button
            type="button"
            className={`worker-mobile-nav-item ${isDashboard ? 'active' : ''}`}
            onClick={() => navigate('/worker/dashboard')}
          >
            <Briefcase size={20} />
            <span>Jobs</span>
          </button>
          <button
            type="button"
            className={`worker-mobile-nav-item ${isNotifications ? 'active' : ''}`}
            onClick={() => navigate('/worker/notifications')}
          >
            <Bell size={20} />
            <span>Alerts</span>
          </button>
          <button
            type="button"
            className={`worker-mobile-nav-item ${isProfile ? 'active' : ''}`}
            onClick={() => navigate('/worker/profile')}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </>
  )
}
