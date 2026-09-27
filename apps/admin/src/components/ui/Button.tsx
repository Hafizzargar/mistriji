import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'ghost'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
  children?: React.ReactNode
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#4f46e5',
    color: '#ffffff',
    border: '1px solid #4338ca',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  secondary: {
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  outline: {
    background: 'transparent',
    color: '#4f46e5',
    border: '1.5px solid #4f46e5',
  },
  danger: {
    background: '#ef4444',
    color: '#ffffff',
    border: '1px solid #dc2626',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  success: {
    background: '#10b981',
    color: '#ffffff',
    border: '1px solid #059669',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  warning: {
    background: '#f59e0b',
    color: '#ffffff',
    border: '1px solid #d97706',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  ghost: {
    background: 'transparent',
    color: '#4b5563',
    border: '1px solid transparent',
  },
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  xs: {
    padding: '4px 10px',
    fontSize: '0.75rem',
    gap: '4px',
  },
  sm: {
    padding: '6px 12px',
    fontSize: '0.8125rem',
    gap: '6px',
  },
  md: {
    padding: '9px 18px',
    fontSize: '0.875rem',
    gap: '8px',
  },
  lg: {
    padding: '13px 24px',
    fontSize: '1rem',
    gap: '10px',
  },
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      disabled,
      children,
      style,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px', // Enforced 8px radius border
      fontWeight: 600,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.65 : 1,
      transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
      width: fullWidth ? '100%' : 'auto',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      ...VARIANT_STYLES[variant],
      ...SIZE_STYLES[size],
      ...style,
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={baseStyle}
        className={`btn-reusable ${className}`}
        {...props}
      >
        {loading ? (
          <span
            style={{
              width: size === 'xs' ? 12 : size === 'sm' ? 14 : 16,
              height: size === 'xs' ? 12 : size === 'sm' ? 14 : 16,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 600ms linear infinite',
              display: 'inline-block',
            }}
          />
        ) : (
          icon
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
