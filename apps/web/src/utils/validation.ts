export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizePhone(value: string): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()

  // Strict 10 digit Indian mobile starting with 6-9
  if (/^[6-9]\d{9}$/.test(trimmed)) {
    return trimmed
  }

  // +91XXXXXXXXXX
  if (/^\+91[6-9]\d{9}$/.test(trimmed)) {
    return trimmed.slice(3)
  }

  // +91 XXXXXXXXXX with spaces or hyphens
  const digits = trimmed.replace(/[\s-]/g, '')
  if (/^\+91[6-9]\d{9}$/.test(digits)) {
    return digits.slice(3)
  }

  return null
}

export function isFakePhone(phone: string): boolean {
  if (!phone) return true
  // Block repeated single digits (e.g. 6666666666, 9999999999)
  return /^(\d)\1{9}$/.test(phone)
}

export function isValidEmail(email: string) {
  return emailRegex.test(email.trim())
}

export function isValidIndianPhone(phone: string) {
  const norm = normalizePhone(phone)
  return norm !== null && !isFakePhone(norm)
}

export function validateLogin(value: string) {
  const input = value.trim()
  if (emailRegex.test(input)) {
    return { type: 'email' as const, valid: true, cleanValue: input.toLowerCase() }
  }

  const normPhone = normalizePhone(input)
  if (normPhone && !isFakePhone(normPhone)) {
    return { type: 'phone' as const, valid: true, cleanValue: normPhone }
  }

  return { type: 'invalid' as const, valid: false, cleanValue: input }
}
