import React, { useEffect } from 'react'
import { useCustomerAuth } from '@/contexts/CustomerAuthContext'
import { Ban, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export function SuspensionAlertModal() {
  const { suspendedAlert, clearSuspendedAlert } = useCustomerAuth()
  const toast = useToast()

  useEffect(() => {
    if (suspendedAlert) {
      try {
        const parsed = JSON.parse(suspendedAlert)
        if (parsed.message) {
          toast.error(parsed.message)
        } else {
          toast.error(suspendedAlert)
        }
      } catch {
        toast.error(suspendedAlert)
      }
    }
  }, [suspendedAlert])

  if (!suspendedAlert) return null

  let alertData = {
    message: suspendedAlert,
    supportEmail: 'support@mistriji.in',
    supportPhone: '+91 9419000000'
  }
  try {
    const parsed = JSON.parse(suspendedAlert)
    if (parsed.code === 'ACCOUNT_SUSPENDED') {
      alertData = parsed
    }
  } catch {}

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '1.25rem',
          maxWidth: 440,
          width: '100%',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          border: '2px solid #ef4444'
        }}
      >
        <div style={{
          background: '#fee2e2',
          color: '#dc2626',
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          boxShadow: '0 0 0 8px #fef2f2'
        }}>
          <Ban size={32} strokeWidth={2.5} />
        </div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b', margin: '0 0 0.5rem 0' }}>
          Account Suspended
        </h2>
        
        <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          {alertData.message}
        </p>

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1rem',
          width: '100%',
          marginBottom: '1.5rem',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
            Need to appeal this decision?
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
            Please contact our support team. We review all suspensions manually.<br/>
            📞 <a href={`tel:${alertData.supportPhone}`} style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{alertData.supportPhone}</a><br/>
            ✉️ <a href={`mailto:${alertData.supportEmail}`} style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{alertData.supportEmail}</a>
          </div>
        </div>

        <button
          onClick={clearSuspendedAlert}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: '0.75rem' }}
        >
          Acknowledge & Close
        </button>
      </div>
    </div>
  )
}
