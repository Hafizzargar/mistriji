import React, { useEffect, useState } from 'react'
import { MapPin, Phone, Heart, MessageCircle, Mail } from 'lucide-react'
import { fetchFooterSettings, FooterSettings } from '@/lib/settings'

export function Footer() {
  const [settings, setSettings] = useState<FooterSettings | null>(null)

  useEffect(() => {
    fetchFooterSettings().then(setSettings)
  }, [])

  const footerSettings = settings || {
    enabled: true,
    brandName: 'MistriJi Jammu',
    description: 'Connecting Jammu residents with trusted, verified local mistris and skilled labourers nearby. Electricians, plumbers, masons, painters, AC technicians, and carpenters sorted by real-time proximity.',
    coverageAreas: ['Gandhi Nagar', 'Trikuta Nagar', 'Satwari', 'Janipur', 'Bakshi Nagar', 'Channi Himmat', 'Talab Tillo', 'Jewel Chowk'],
    helplinePhone: '+91 9876543210',
    whatsappNumber: '+91 9876543210',
    supportEmail: 'support@mistriji.com',
    officeAddress: 'Jammu Head Office, J&K',
    copyrightText: '© 2026 MistriJi Jammu. All rights reserved.',
    builtWithText: 'Built with ❤️ for Jammu Community',
  }

  const helpline = footerSettings.helplinePhone?.trim()
  const whatsapp = footerSettings.whatsappNumber?.trim()
  const email = footerSettings.supportEmail?.trim()
  const coverageAreas = footerSettings.coverageAreas?.filter(Boolean) || []

  return (
    <footer className="footer-wrapper">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '0.625rem', letterSpacing: '-0.5px' }}>
              {footerSettings.brandName.split(' ').map((part, index) => (
                index === 0 ? <span key={part}>{part}</span> : <span key={part} style={{ color: '#818cf8' }}> {part}</span>
              ))}
            </div>
            <p style={{ color: 'var(--gray-400)', maxWidth: 420, lineHeight: 1.6, fontSize: '0.825rem' }}>
              {footerSettings.description}
            </p>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
              Key Coverage Areas
            </div>
            <div className="footer-area-chips">
              {coverageAreas.length ? coverageAreas.map(area => (
                <span key={area} className="footer-area-chip">📍 {area}</span>
              )) : (
                <span className="footer-area-chip">📍 Jammu</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
              Support & Helpline
            </div>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {helpline && (
                <a
                  href={`tel:${helpline.replace(/\s+/g, '')}`}
                  style={{ color: '#818cf8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                >
                  <Phone size={14} /> {helpline}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                >
                  <MessageCircle size={14} /> WhatsApp Support
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  style={{ color: '#a5b4fc', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                >
                  <Mail size={14} /> {email}
                </a>
              )}
              <div style={{ color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <MapPin size={14} /> {footerSettings.officeAddress}
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div>{footerSettings.copyrightText}</div>
          <div>
            {footerSettings.builtWithText.includes('❤️') ? (
              <>
                {footerSettings.builtWithText.replace('❤️', '')}
                <Heart size={12} style={{ color: '#ef4444', display: 'inline', verticalAlign: 'middle', margin: '0 0.2rem' }} />
                {footerSettings.builtWithText.includes('for') ? footerSettings.builtWithText.split('for').slice(1).join('for') : ''}
              </>
            ) : (
              footerSettings.builtWithText
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
