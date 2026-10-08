/**
 * ─── Hardened OTP Store ─────────────────────────────────────
 * Persistent OTP store supporting multi-instance deployments (via Supabase)
 * with CSPRNG (crypto.randomInt) and automatic expiry.
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const OTP_EXPIRY_MS = 5 * 60 * 1000   // 5 minutes
const MAX_ATTEMPTS = 5                  // Max wrong attempts before lockout

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

// In-memory fallback map for offline/local development without Supabase DB table
const memoryStore = new Map()

/**
 * Generate a 6-digit cryptographically secure numeric OTP
 */
function generateOTP() {
  return String(crypto.randomInt(100000, 1000000))
}

/**
 * Store an OTP for a given identifier (phone or email).
 */
async function setOTP(identifier, options = {}) {
  const key = identifier.toLowerCase().trim()
  const expiryMs = options.isAdmin ? 60 * 1000 : OTP_EXPIRY_MS
  const expiresAt = Date.now() + expiryMs
  const code = generateOTP()
  const isAdmin = options.isAdmin || false

  if (supabase) {
    try {
      // Check existing active OTP
      const { data: existing } = await supabase
        .from('otp_store')
        .select('*')
        .eq('identifier', key)
        .maybeSingle()

      if (existing && Date.now() < new Date(existing.expires_at).getTime()) {
        return { code: existing.code, error: null, reused: true, expiresAt: new Date(existing.expires_at).getTime() }
      }

      // Upsert new OTP
      const { error: upsertErr } = await supabase
        .from('otp_store')
        .upsert({
          identifier: key,
          code,
          expires_at: new Date(expiresAt).toISOString(),
          attempts: 0,
          is_admin: isAdmin
        })

      if (upsertErr) {
        console.error('Supabase OTP store error, falling back to memory:', upsertErr)
      } else {
        return { code, error: null, reused: false, expiresAt }
      }
    } catch (err) {
      console.error('Supabase OTP exception, falling back to memory:', err)
    }
  }

  // Fallback to memory store
  const existingMem = memoryStore.get(key)
  if (existingMem && Date.now() < existingMem.expiresAt) {
    return { code: existingMem.code, error: null, reused: true, expiresAt: existingMem.expiresAt }
  }

  memoryStore.set(key, { code, expiresAt, attempts: 0, isAdmin })
  setTimeout(() => {
    const entry = memoryStore.get(key)
    if (entry && entry.code === code) memoryStore.delete(key)
  }, expiryMs + 1000)

  return { code, error: null, reused: false, expiresAt }
}

/**
 * Verify an OTP for a given identifier.
 */
async function verifyOTP(identifier, code, keepAlive = false) {
  const key = identifier.toLowerCase().trim()
  const cleanCode = String(code).trim()

  if (supabase) {
    try {
      const { data: entry, error: fetchErr } = await supabase
        .from('otp_store')
        .select('*')
        .eq('identifier', key)
        .maybeSingle()

      if (fetchErr || !entry) {
        return { valid: false, error: 'OTP expired or not found. Please request a new one.' }
      }

      if (Date.now() > new Date(entry.expires_at).getTime()) {
        await supabase.from('otp_store').delete().eq('identifier', key)
        return { valid: false, error: 'OTP has expired. Please request a new one.' }
      }

      if (entry.attempts >= MAX_ATTEMPTS) {
        await supabase.from('otp_store').delete().eq('identifier', key)
        return { valid: false, error: 'Too many wrong attempts. Please request a new OTP.' }
      }

      if (entry.code !== cleanCode) {
        const newAttempts = entry.attempts + 1
        await supabase.from('otp_store').update({ attempts: newAttempts }).eq('identifier', key)
        return { valid: false, error: `Invalid OTP. ${MAX_ATTEMPTS - newAttempts} attempts remaining.` }
      }

      if (!keepAlive) {
        await supabase.from('otp_store').delete().eq('identifier', key)
      }

      return { valid: true }
    } catch (err) {
      console.error('Supabase OTP verify exception, falling back to memory:', err)
    }
  }

  // Fallback to memory store
  const entry = memoryStore.get(key)
  if (!entry) return { valid: false, error: 'OTP expired or not found. Please request a new one.' }
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key)
    return { valid: false, error: 'OTP has expired. Please request a new one.' }
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    memoryStore.delete(key)
    return { valid: false, error: 'Too many wrong attempts. Please request a new OTP.' }
  }
  if (entry.code !== cleanCode) {
    entry.attempts++
    return { valid: false, error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.` }
  }
  if (!keepAlive) memoryStore.delete(key)
  return { valid: true }
}

async function deleteOTP(identifier) {
  const key = identifier.toLowerCase().trim()
  if (supabase) {
    await supabase.from('otp_store').delete().eq('identifier', key).catch(() => {})
  }
  memoryStore.delete(key)
}

async function consumeOTP(identifier, code) {
  const key = identifier.toLowerCase().trim()
  const cleanCode = String(code).trim()

  if (supabase) {
    try {
      const { data: entry } = await supabase
        .from('otp_store')
        .select('*')
        .eq('identifier', key)
        .maybeSingle()

      if (entry && entry.code === cleanCode) {
        await supabase.from('otp_store').delete().eq('identifier', key)
        return true
      }
      return false
    } catch {
      // fallback
    }
  }

  const entry = memoryStore.get(key)
  if (entry && entry.code === cleanCode) {
    memoryStore.delete(key)
    return true
  }
  return false
}

module.exports = { generateOTP, setOTP, verifyOTP, deleteOTP, consumeOTP }
