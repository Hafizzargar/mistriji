import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Star, CheckCircle, Clock, Users } from 'lucide-react'

export function CustomerBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  const isHome = path === '/customer/dashboard' || path === '/customer'
  const isBookings = path.startsWith('/customer/bookings')
  const isMessages = path.startsWith('/customer/notifications')
  const isProfile = path.startsWith('/customer/profile')

  return (
    <>
      <style>{`
        .customer-mobile-bottom-nav {
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
        .customer-mobile-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 500px;
          margin: 0 auto;
        }
        .customer-mobile-nav-item {
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
        .customer-mobile-nav-item:active {
          transform: scale(0.94);
        }
        .customer-mobile-nav-item.active {
          color: #818cf8;
        }
        .customer-mobile-nav-item.active svg {
          filter: drop-shadow(0 0 6px rgba(129, 140, 248, 0.6));
        }
        .customer-mobile-nav-item svg {
          transition: transform 0.2s;
        }
        @media (max-width: 768px) {
          .customer-mobile-bottom-nav {
            display: block;
          }
          /* Add bottom padding to body/layouts on mobile so content isn't obscured by fixed bottom nav */
          .customer-layout-content {
            padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
        @media (min-width: 769px) {
          .customer-mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
      <nav className="customer-mobile-bottom-nav" aria-label="Customer Navigation">
        <div className="customer-mobile-nav-inner">
          <button
            type="button"
            className={`customer-mobile-nav-item ${isHome ? 'active' : ''}`}
            onClick={() => navigate('/customer/dashboard')}
          >
            <Star size={20} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`customer-mobile-nav-item ${isBookings ? 'active' : ''}`}
            onClick={() => navigate('/customer/bookings')}
          >
            <CheckCircle size={20} />
            <span>Bookings</span>
          </button>
          <button
            type="button"
            className={`customer-mobile-nav-item ${isMessages ? 'active' : ''}`}
            onClick={() => navigate('/customer/notifications')}
          >
            <Clock size={20} />
            <span>Messages</span>
          </button>
          <button
            type="button"
            className={`customer-mobile-nav-item ${isProfile ? 'active' : ''}`}
            onClick={() => navigate('/customer/profile')}
          >
            <Users size={20} />
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </>
  )
}
