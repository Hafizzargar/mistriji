import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Compass, Sparkles } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title?: string
  message: string
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    // If it's a replacement status (like GPS info -> GPS success), auto-trim older infos
    setToasts(prev => {
      const filtered = type === 'success' && message.includes('GPS')
        ? prev.filter(p => !p.message.includes('Detecting your GPS'))
        : prev
      return [...filtered.slice(-3), { id, type, message }]
    })
    setTimeout(() => removeToast(id), 4200)
  }, [removeToast])

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast])
  const error   = useCallback((msg: string) => showToast(msg, 'error'), [showToast])
  const info    = useCallback((msg: string) => showToast(msg, 'info'), [showToast])
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast])

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div
        className="toast-container-wrapper"
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          pointerEvents: 'none',
          maxWidth: 390,
          width: 'calc(100% - 2rem)',
        }}
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const isGps = toast.message.includes('GPS') || toast.message.includes('📍')

  const theme = {
    success: {
      bg: 'rgba(255, 255, 255, 0.98)',
      border: 'rgba(16, 185, 129, 0.3)',
      accent: '#10b981',
      title: 'Success',
      icon: isGps ? <Compass size={17} style={{ color: '#059669' }} /> : <CheckCircle2 size={17} style={{ color: '#059669' }} />,
      iconBg: '#ecfdf5',
      textColor: '#0f172a',
      subColor: '#334155',
      glow: '0 8px 30px -4px rgba(16, 185, 129, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06)',
    },
    error: {
      bg: 'rgba(255, 255, 255, 0.98)',
      border: 'rgba(239, 68, 68, 0.3)',
      accent: '#ef4444',
      title: 'Notice',
      icon: <AlertCircle size={17} style={{ color: '#dc2626' }} />,
      iconBg: '#fef2f2',
      textColor: '#0f172a',
      subColor: '#334155',
      glow: '0 8px 30px -4px rgba(239, 68, 68, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06)',
    },
    warning: {
      bg: 'rgba(255, 255, 255, 0.98)',
      border: 'rgba(245, 158, 11, 0.3)',
      accent: '#f59e0b',
      title: 'Alert',
      icon: <AlertTriangle size={17} style={{ color: '#d97706' }} />,
      iconBg: '#fffbeb',
      textColor: '#0f172a',
      subColor: '#334155',
      glow: '0 8px 30px -4px rgba(245, 158, 11, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06)',
    },
    info: {
      bg: 'rgba(255, 255, 255, 0.98)',
      border: 'rgba(99, 102, 241, 0.25)',
      accent: '#6366f1',
      title: 'Location & System',
      icon: isGps ? <Compass size={17} style={{ color: '#4f46e5' }} /> : <Info size={17} style={{ color: '#4f46e5' }} />,
      iconBg: '#eef2ff',
      textColor: '#0f172a',
      subColor: '#334155',
      glow: '0 8px 30px -4px rgba(99, 102, 241, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06)',
    },
  }[toast.type]

  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: '0.875rem',
        background: theme.bg,
        border: `1.5px solid ${theme.border}`,
        boxShadow: theme.glow,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left colored indicator strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: theme.accent,
        }}
      />

      {/* Icon Badge */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '0.5rem',
          background: theme.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {theme.icon}
      </div>

      {/* Message Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.accent,
            marginBottom: '0.15rem',
            lineHeight: 1.2,
          }}
        >
          {theme.title}
        </div>
        <div
          style={{
            fontSize: '0.825rem',
            fontWeight: 600,
            color: theme.textColor,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0.25rem',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 150ms ease',
          flexShrink: 0,
          marginTop: '-2px',
          marginRight: '-4px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#334155'
          e.currentTarget.style.background = '#f1f5f9'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = '#94a3b8'
          e.currentTarget.style.background = 'transparent'
        }}
        title="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
