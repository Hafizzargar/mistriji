/**
 * ─── OTP Store ────────────────────────────────────────────
 * In-memory store for OTP codes with automatic expiry.
 * Key = phone or email (lowercased)
 * Value = { code, expiresAt, attempts }
 *
 * Production consideration: Replace with Redis for multi-instance deploys.
 */

const OTP_EXPIRY_MS = 5 * 60 * 1000   // 5 minutes
const MAX_ATTEMPTS = 5                  // Max wrong attempts before lockout
const RESEND_COOLDOWN_MS = 60 * 1000   // 60 seconds between resends

const store = new Map()

/**
 * Generate a 6-digit numeric OTP
 */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Store an OTP for a given identifier (phone or email).
 * Returns the generated code.
 */
function setOTP(identifier, options = {}) {
  const key = identifier.toLowerCase().trim()
  const bypassCooldown = options.bypassCooldown || options.isAdmin || false
  
  // Cooldown check (skipped for administrators/super admins)
  const existing = store.get(key)
  if (!bypassCooldown && existing && (Date.now() - (existing.createdAt || 0)) < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.createdAt)) / 1000)
    return { error: `Please wait ${waitSec}s before requesting a new OTP.`, code: null }
  }

  const code = generateOTP()
  store.set(key, {
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  })

  // Auto-cleanup after expiry
  setTimeout(() => {
    const entry = store.get(key)
    if (entry && entry.code === code) {
      store.delete(key)
    }
  }, OTP_EXPIRY_MS + 1000)

  return { code, error: null }
}

/**
 * Verify an OTP for a given identifier.
 * Returns { valid: boolean, error?: string }
 */
function verifyOTP(identifier, code, keepAlive = false) {
  const key = identifier.toLowerCase().trim()
  const entry = store.get(key)

  if (!entry) {
    return { valid: false, error: 'OTP expired or not found. Please request a new one.' }
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return { valid: false, error: 'OTP has expired. Please request a new one.' }
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key)
    return { valid: false, error: 'Too many wrong attempts. Please request a new OTP.' }
  }

  if (entry.code !== String(code).trim()) {
    entry.attempts++
    return { valid: false, error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.` }
  }

  // Success — clear the OTP unless keepAlive is true
  if (!keepAlive) {
    store.delete(key)
  }
  
  return { valid: true }
}

module.exports = { generateOTP, setOTP, verifyOTP }
