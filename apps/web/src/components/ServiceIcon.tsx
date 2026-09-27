import React from 'react'
import {
  Zap,
  Wrench,
  Snowflake,
  Hammer,
  Paintbrush,
  HardHat,
  Flame,
  Bug,
  Sparkles,
  Briefcase,
  Droplets,
  Layers,
  ShieldCheck,
  Building,
  Scissors
} from 'lucide-react'

interface ServiceIconProps {
  name?: string
  icon?: string | null
  category?: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Modern vector icon renderer for skills/services
 * Replaces plain emoji with clean, sharp Lucide vector icons
 */
export function ServiceIcon({
  name = '',
  icon = '',
  category = '',
  size = 18,
  className = '',
  style = {},
}: ServiceIconProps) {
  const combinedKey = `${name} ${icon} ${category}`.toLowerCase()

  // Dynamic icon selection with specific brand color themes
  if (combinedKey.includes('electric') || combinedKey.includes('बिजली') || combinedKey.includes('⚡')) {
    return <Zap size={size} className={className} style={{ color: '#eab308', ...style }} />
  }
  if (combinedKey.includes('plumb') || combinedKey.includes('नल') || combinedKey.includes('🔧') || combinedKey.includes('पाइप')) {
    return <Wrench size={size} className={className} style={{ color: '#0284c7', ...style }} />
  }
  if (combinedKey.includes('ac') || combinedKey.includes('air') || combinedKey.includes('cooler') || combinedKey.includes('❄️')) {
    return <Snowflake size={size} className={className} style={{ color: '#06b6d4', ...style }} />
  }
  if (combinedKey.includes('mason') || combinedKey.includes('राजमिस्त्री') || combinedKey.includes('brick') || combinedKey.includes('🧱')) {
    return <Building size={size} className={className} style={{ color: '#d97706', ...style }} />
  }
  if (combinedKey.includes('carpent') || combinedKey.includes('बढ़ई') || combinedKey.includes('wood') || combinedKey.includes('🪚')) {
    return <Hammer size={size} className={className} style={{ color: '#b45309', ...style }} />
  }
  if (combinedKey.includes('paint') || combinedKey.includes('पेंट') || combinedKey.includes('color') || combinedKey.includes('🖌️')) {
    return <Paintbrush size={size} className={className} style={{ color: '#8b5cf6', ...style }} />
  }
  if (combinedKey.includes('help') || combinedKey.includes('हेल्पर') || combinedKey.includes('labour') || combinedKey.includes('👷')) {
    return <HardHat size={size} className={className} style={{ color: '#f59e0b', ...style }} />
  }
  if (combinedKey.includes('weld') || combinedKey.includes('वेल्डर') || combinedKey.includes('iron') || combinedKey.includes('🔥')) {
    return <Flame size={size} className={className} style={{ color: '#ef4444', ...style }} />
  }
  if (combinedKey.includes('pest') || combinedKey.includes('कीट') || combinedKey.includes('insect') || combinedKey.includes('🐛')) {
    return <Bug size={size} className={className} style={{ color: '#10b981', ...style }} />
  }
  if (combinedKey.includes('clean') || combinedKey.includes('सफाई') || combinedKey.includes('broom') || combinedKey.includes('🧹')) {
    return <Sparkles size={size} className={className} style={{ color: '#14b8a6', ...style }} />
  }

  // Fallback icon
  return <Briefcase size={size} className={className} style={{ color: 'var(--brand-600)', ...style }} />
}
