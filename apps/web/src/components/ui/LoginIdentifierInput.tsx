import React from 'react'
import { User, Phone, Mail } from 'lucide-react'
import { validateLogin } from '@/utils/validation'

interface LoginIdentifierInputProps {
  value: string
  onChange: (val: string) => void
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function LoginIdentifierInput({ value, onChange, error, disabled, autoFocus }: LoginIdentifierInputProps) {
  const result = value ? validateLogin(value) : null

  let Icon = User
  if (result?.type === 'email') Icon = Mail
  if (result?.type === 'phone') Icon = Phone

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.35rem' }}>
        Mobile Number or Email
      </label>
      <div style={{ position: 'relative' }}>
        <Icon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: error ? '#ef4444' : 'var(--gray-400)' }} />
        <input
          type="text"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 9876543210 or you@email.com"
          disabled={disabled}
          autoFocus={autoFocus}
          style={{
            paddingLeft: '2.75rem',
            fontSize: '0.95rem',
            width: '100%',
            borderColor: error ? '#ef4444' : undefined,
            boxShadow: error ? '0 0 0 1px #ef4444' : undefined
          }}
        />
        {result?.valid && (
          <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
            Valid {result.type === 'phone' ? 'Phone' : 'Email'}
          </div>
        )}
      </div>
      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.35rem 0 0', fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  )
}
