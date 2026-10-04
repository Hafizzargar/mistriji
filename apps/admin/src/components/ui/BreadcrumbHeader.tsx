import React from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export interface BreadcrumbHeaderProps {
  parentLabel: string
  onBack: () => void
  title: string
  subtitle: string
  currentLabel?: string
  children?: React.ReactNode
}

export function BreadcrumbHeader({ 
  parentLabel, 
  onBack, 
  title, 
  subtitle, 
  currentLabel = 'Profile',
  children
}: BreadcrumbHeaderProps) {
  return (
    <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1.5rem' }}>
      <button 
        className="btn btn-secondary" 
        onClick={onBack} 
        style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Go Back"
      >
        <ArrowLeft size={18} />
      </button>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <button 
            onClick={onBack}
            style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            className="hover-text"
          >
            {parentLabel}
          </button>
          <ChevronRight size={14} color="#94a3b8" />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>{currentLabel}</span>
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {children && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {children}
        </div>
      )}
    </div>
  )
}
