import React, { useEffect } from 'react'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { X, HardHat, User, ArrowRight } from 'lucide-react'

export function RoleSelectionModal() {
  const { showRoleModal, closeRoleModal, openLoginModal } = useCustomerAuth()

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (showRoleModal) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showRoleModal])

  if (!showRoleModal) return null

  const handleCustomerSelect = () => {
    closeRoleModal()
    openLoginModal()
  }

  const handleWorkerSelect = () => {
    closeRoleModal()
    window.dispatchEvent(new CustomEvent('open-worker-register', { detail: { openLogin: true } }))
  }

  return (
    <div
      onClick={closeRoleModal}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2500, // Higher than other modals
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '1.25rem',
          maxWidth: 440,
          width: '100%',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          animation: 'slideUp 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <button
          onClick={closeRoleModal}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--gray-100)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gray-500)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-200)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--gray-100)')}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, marginBottom: '0.5rem' }}>
            Welcome to MistriJi
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
            How would you like to use our platform today?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Customer Option */}
          <button
            onClick={handleCustomerSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem',
              borderRadius: '1rem',
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#818cf8'
              e.currentTarget.style.background = '#eef2ff'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '0.75rem',
                background: '#4f46e5',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e1b4b', marginBottom: '0.15rem' }}>
                  I am a Customer
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  I need to book a service or hire a worker
                </div>
              </div>
            </div>
            <ArrowRight size={20} style={{ color: '#4f46e5' }} />
          </button>

          {/* Worker Option */}
          <button
            onClick={handleWorkerSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem',
              borderRadius: '1rem',
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#10b981'
              e.currentTarget.style.background = '#f0fdf4'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '0.75rem',
                background: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <HardHat size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#064e3b', marginBottom: '0.15rem' }}>
                  I am a Worker Partner
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  I want to accept jobs and offer my skills
                </div>
              </div>
            </div>
            <ArrowRight size={20} style={{ color: '#10b981' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
