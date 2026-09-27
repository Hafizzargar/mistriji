import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void
    error: (message: string, title?: string, duration?: number) => void
    info: (message: string, title?: string, duration?: number) => void
    warning: (message: string, title?: string, duration?: number) => void
    custom: (type: ToastType, message: string, title?: string, duration?: number) => void
  }
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// User-friendly error message formatter (converts raw SQL/Postgres errors to clean text)
export function formatErrorMessage(rawMessage: string): string {
  if (!rawMessage) return 'An unexpected error occurred.'
  if (rawMessage.includes('users_phone_key') || rawMessage.includes('duplicate key value')) {
    return 'This mobile number is already registered in the system.'
  }
  if (rawMessage.includes('row-level security policy') || rawMessage.includes('403')) {
    return 'Permission denied. Please check your admin privileges.'
  }
  if (rawMessage.includes('invalid_grant') || rawMessage.includes('Invalid credentials')) {
    return 'Invalid phone number or PIN.'
  }
  return rawMessage
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const formattedMsg = type === 'error' ? formatErrorMessage(message) : message

    setToasts(prev => [...prev.slice(-4), { id, type, title, message: formattedMsg, duration }]) // Keep max 5

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = {
    success: (message: string, title?: string, duration?: number) => addToast('success', message, title, duration),
    error:   (message: string, title?: string, duration?: number) => addToast('error', message, title, duration),
    info:    (message: string, title?: string, duration?: number) => addToast('info', message, title, duration),
    warning: (message: string, title?: string, duration?: number) => addToast('warning', message, title, duration),
    custom:  (type: ToastType, message: string, title?: string, duration?: number) => addToast(type, message, title, duration),
  }

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div style={containerStyle}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context.toast
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const config = {
    success: {
      bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', iconColor: '#16a34a',
      icon: <CheckCircle2 size={18} />, defaultTitle: 'Success'
    },
    error: {
      bg: '#fef2f2', border: '#fecaca', text: '#991b1b', iconColor: '#dc2626',
      icon: <AlertCircle size={18} />, defaultTitle: 'Error'
    },
    warning: {
      bg: '#fffbeb', border: '#fde68a', text: '#b45309', iconColor: '#d97706',
      icon: <AlertTriangle size={18} />, defaultTitle: 'Warning'
    },
    info: {
      bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', iconColor: '#2563eb',
      icon: <Info size={18} />, defaultTitle: 'Notice'
    },
  }[toast.type]

  return (
    <div style={{
      ...itemStyle,
      background: config.bg,
      border: `1px solid ${config.border}`,
      color: config.text,
    }}>
      <div style={{ color: config.iconColor, display: 'flex', alignItems: 'center', marginTop: '1px' }}>
        {config.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: toast.message ? '2px' : 0 }}>
          {toast.title || config.defaultTitle}
        </div>
        {toast.message && (
          <div style={{ fontSize: '0.8rem', opacity: 0.9, lineHeight: 1.4 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button onClick={onClose} style={closeBtnStyle}>
        <X size={14} />
      </button>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '1.25rem',
  right: '1.25rem',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  pointerEvents: 'none',
  maxWidth: 380,
  width: '100%',
}

const itemStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: '0.625rem',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
  animation: 'slideInRight 0.25s ease-out forwards',
  transition: 'all 0.2s ease',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  opacity: 0.6,
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
}
