/**
 * ─── MistriJi Auth API Server ─────────────────────────────
 * Express server providing OTP-based authentication:
 *   POST /api/otp/send    — Send OTP via email or SMS
 *   POST /api/otp/verify  — Verify OTP code
 *   POST /api/otp/resend  — Resend OTP
 *   GET  /api/health      — Health check
 *
 * Runs on port 3002 by default.
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { setOTP, verifyOTP, deleteOTP, consumeOTP } = require('./otpStore')
const { sendEmailOTP, sendEmailNotification, sendAdminWelcomeEmail } = require('./emailService')
const { sendSmsOTP, sendSmsNotification } = require('./smsService')
const { logError } = require('./errorMonitor')

const app = express()
app.use(cookieParser())
const PORT = process.env.PORT || 3002

// ─── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow all origins for now so Vercel can connect
  credentials: true,
}))
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}))

// ─── Routes ───────────────────────────────────────────────
const paymentRoutes = require('./routes/payments')
app.use('/api/payments', paymentRoutes)

// ─── Advanced Rate Limiter (In-Memory) ─────────────────────
const ONE_MINUTE = 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000

let dailyTotalRequests = [] // Array of timestamps
const ipRequests = new Map() // IP -> Array of timestamps
const identifierRequests = new Map() // phone/email -> Array of timestamps

const MAX_DAILY_GLOBAL = 100
const MAX_DAILY_PER_IP = 20
const MAX_DAILY_PER_ID = 5
const COOLDOWN_PER_ID = ONE_MINUTE

function cleanupOldTimestamps(timestamps) {
  const cutoffDay = Date.now() - ONE_DAY
  return timestamps.filter(t => t > cutoffDay)
}

// Cleanup periodically to prevent memory leaks
setInterval(() => {
  dailyTotalRequests = cleanupOldTimestamps(dailyTotalRequests)
  for (const [key, stamps] of ipRequests) {
    const valid = cleanupOldTimestamps(stamps)
    if (valid.length === 0) ipRequests.delete(key)
    else ipRequests.set(key, valid)
  }
  for (const [key, stamps] of identifierRequests) {
    const valid = cleanupOldTimestamps(stamps)
    if (valid.length === 0) identifierRequests.delete(key)
    else identifierRequests.set(key, valid)
  }
}, 60 * 60 * 1000)

function isLoopbackIp(ip) {
  return !ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'
}

async function isSuperAdminOrAdmin(identifier, req = null, returnFullUser = false) {
  if (!identifier) return returnFullUser ? null : false
  const cleanId = String(identifier).trim().toLowerCase()
  const cleanPhone = String(identifier).replace(/\D/g, '').slice(-10)

  const adminEmail = (process.env.ADMIN_EMAIL || 'hafezzargar987@gmail.com').toLowerCase()
  const adminPhone = (process.env.ADMIN_PHONE || '6005950197').replace(/\D/g, '').slice(-10)

  if (cleanId === adminEmail || (cleanPhone.length === 10 && cleanPhone === adminPhone)) {
    if (!returnFullUser) return true
    // If they match hardcoded admin but we requested full user, we still must hit the DB below
  }

  // Supabase check
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      let filter = ''
      if (cleanId.includes('@')) {
        filter = `email=ilike.${encodeURIComponent(cleanId)}`
      } else if (cleanPhone.length === 10) {
        filter = `phone=ilike.*${cleanPhone}*`
      } else {
        filter = `or=(email.ilike.${encodeURIComponent(cleanId)},phone.ilike.*${cleanPhone}*)`
      }
      const url = `${process.env.SUPABASE_URL}/rest/v1/users?select=id,role,status&${filter}&limit=5`
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      })
      if (res.ok) {
        const users = await res.json()
        if (Array.isArray(users) && users.length > 0) {
          const match = users.find(u => (u.role === 'admin' || u.role === 'super_admin') && u.status !== 'disabled' && u.status !== 'suspended')
          if (match) return returnFullUser ? match : true
        }
      }
    } catch (e) {
      console.error('Supabase admin check error:', e)
    }
  }
  return returnFullUser ? null : false
}

// ─── Blocked Account Status Check (with In-Memory Caching) ─────────────────────────
const BLOCKED_ACCOUNT_STATUSES = new Set(['suspended', 'disabled', 'deactivated'])
const accountStatusCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

async function getAccountStatus(identifier) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !identifier) return null
  
  const cleanId = String(identifier).trim().toLowerCase()
  if (accountStatusCache.has(cleanId)) {
    const cached = accountStatusCache.get(cleanId)
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
  }

  const cleanPhone = String(identifier).replace(/\D/g, '').slice(-10)
  
  let filter = ''
  if (cleanId.includes('@')) {
    filter = `email=ilike.${encodeURIComponent(cleanId)}`
  } else if (cleanPhone.length === 10) {
    filter = `or=(phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.ilike.*${cleanPhone}*)`
  } else {
    return null
  }

  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/users?select=id,role,status&${filter}&limit=1`
    const response = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    })
    if (!response.ok) {
      accountStatusCache.set(cleanId, { data: null, timestamp: Date.now() })
      return null
    }
    const users = await response.json()
    const result = (Array.isArray(users) && users.length > 0) ? users[0] : null
    accountStatusCache.set(cleanId, { data: result, timestamp: Date.now() })
    return result
  } catch (e) {
    console.error('Account status check error:', e)
    return null
  }
}


function checkOtpRateLimits(ip, identifier, isAdmin = false) {
  if (isAdmin) return null // Super Admins and Admins can log in multiple times without limits

  const now = Date.now()
  const isDev = process.env.NODE_ENV !== 'production'
  
  dailyTotalRequests = cleanupOldTimestamps(dailyTotalRequests)
  if (!isDev && dailyTotalRequests.length >= MAX_DAILY_GLOBAL) {
    return 'Daily system OTP limit reached. Please try again tomorrow.'
  }

  let ipStamps = cleanupOldTimestamps(ipRequests.get(ip) || [])
  const maxIpLimit = (isDev && isLoopbackIp(ip)) ? 1000 : MAX_DAILY_PER_IP
  if (ipStamps.length >= maxIpLimit) {
    return 'Too many OTP requests from this device. Please try again tomorrow.'
  }

  if (identifier) {
    let idStamps = cleanupOldTimestamps(identifierRequests.get(identifier) || [])
    const maxIdLimit = isDev ? 50 : MAX_DAILY_PER_ID
    if (idStamps.length >= maxIdLimit) {
      return 'Maximum OTP requests reached for this number/email today. Try again tomorrow.'
    }
    
    if (idStamps.length > 0) {
      const lastRequest = Math.max(...idStamps)
      if (now - lastRequest < (isDev ? 5000 : COOLDOWN_PER_ID)) {
        return 'Please wait a moment before requesting another OTP.'
      }
    }
  }

  return null
}

function recordOtpRequest(ip, identifier, isAdmin = false) {
  if (isAdmin) return // Do not consume global or IP quotas for admins

  const now = Date.now()
  dailyTotalRequests.push(now)
  
  const ipStamps = ipRequests.get(ip) || []
  ipStamps.push(now)
  ipRequests.set(ip, ipStamps)
  
  if (identifier) {
    const idStamps = identifierRequests.get(identifier) || []
    idStamps.push(now)
    identifierRequests.set(identifier, idStamps)
  }
}

async function otpRateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress
  const { identifier } = req.body
  
  // Check if admin / super admin
  const isAdmin = await isSuperAdminOrAdmin(identifier, req)
  req.isAdmin = isAdmin

  // Don't apply identifier/global limits to /verify, only to /send and /resend
  const isSend = req.path === '/api/otp/send' || req.path === '/api/otp/resend'
  
  // Simple IP check for verify to prevent brute-force
  if (!isSend) {
    if (isAdmin) return next()
    let ipStamps = cleanupOldTimestamps(ipRequests.get(ip) || [])
    // 50 attempts per IP per day for verification
    if (ipStamps.length > 50 && !isLoopbackIp(ip)) {
      return res.status(429).json({ error: 'Too many requests from this IP. Try again tomorrow.' })
    }
    return next()
  }

  const errorMsg = checkOtpRateLimits(ip, identifier, isAdmin)
  if (errorMsg) {
    return res.status(429).json({ error: errorMsg })
  }
  
  recordOtpRequest(ip, identifier, isAdmin)
  next()
}

// Reset rate limits endpoint for admin/dev
app.post('/api/otp/reset-limits', (req, res) => {
  dailyTotalRequests = []
  ipRequests.clear()
  identifierRequests.clear()
  res.json({ success: true, message: 'All in-memory rate limits have been reset.' })
})

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MistriJi Auth API',
    timestamp: new Date().toISOString(),
    email: process.env.SMTP_EMAIL ? '✅ configured' : '❌ missing',
    sms: process.env.FAST2SMS_API_KEY ? '✅ configured' : '❌ missing',
  })
})

// ─── Send OTP ─────────────────────────────────────────────
app.post('/api/otp/send', otpRateLimitMiddleware, async (req, res) => {
  const { identifier, type, role } = req.body
  const isAdmin = req.isAdmin || false
  const isAdminPortal = req.headers['x-admin-portal'] === 'true' || role === 'admin'

  // type = 'email' or 'phone'
  if (!identifier || !type) {
    return res.status(400).json({ error: 'Missing identifier or type.' })
  }

  // If request originates from Admin Portal or requests admin role, strictly verify that account exists and is an admin
  if (isAdminPortal && !isAdmin) {
    return res.status(403).json({
      error: 'No administrator account found with this email or mobile number. Access is restricted to registered administrators.'
    })
  }

  // ── SECURITY GATE: Strict Account Verification ──
  // Check if account exists and block if suspended
  const accountUser = await getAccountStatus(identifier)

  if (!isAdmin && !isAdminPortal) {
    // 1. Enforce Login Flow: Unknown users cannot receive an OTP
    if (!accountUser) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        error: 'No account exists with this email or mobile number. Please register first.'
      })
    }

    // 2. Block Suspended Accounts
    const isSuperAdmin = accountUser?.role === 'super_admin'
    if (!isSuperAdmin && accountUser && BLOCKED_ACCOUNT_STATUSES.has((accountUser.status || '').toLowerCase())) {
      console.log(`   ⛔ OTP BLOCKED — Account suspended: ${identifier} (status=${accountUser.status})`)
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        error: 'Your account has been suspended or deactivated by administration. Please contact support.'
      })
    }
  }

  if (type === 'email') {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(identifier)) {
      return res.status(400).json({ error: 'Invalid email address.' })
    }

    // Generate our own OTP for email (managed via otpStore)
    const { code, error: otpError, reused, expiresAt } = setOTP(identifier, { isAdmin })
    if (otpError) {
      return res.status(429).json({ error: otpError })
    }

    const masked = identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
    
    if (!reused) {
      sendEmailOTP(identifier, code).catch(err => console.error('Background Email OTP error:', err))
    }

    return res.json({ success: true, reused, message: reused ? 'OTP already sent.' : `OTP sent to ${masked}`, expiresAt })

  } else if (type === 'phone') {
    const cleanPhone = identifier.replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' })
    }

    // Generate our own OTP for SMS (managed via otpStore)
    const { code, error: otpError, reused, expiresAt } = setOTP(identifier, { isAdmin })
    if (otpError) {
      return res.status(429).json({ error: otpError })
    }

    if (!reused) {
      sendSmsOTP(cleanPhone, code).catch(err => console.error('Background SMS OTP error:', err))
    }

    return res.json({
      success: true,
      reused,
      message: reused ? 'OTP already sent.' : `OTP sent to ******${cleanPhone.slice(-4)}`,
      expiresAt,
    })

  } else {
    return res.status(400).json({ error: 'Type must be "email" or "phone".' })
  }
})

// ─── Verify OTP ───────────────────────────────────────────
app.post('/api/otp/verify', otpRateLimitMiddleware, async (req, res) => {
  const { identifier, code, type } = req.body

  console.log('\n🔐 [OTP VERIFY] ─────────────────────────────────')
  console.log(`   Identifier : ${identifier}`)
  console.log(`   Code       : ${code}`)
  console.log(`   Type       : ${type}`)
  console.log(`   Admin Portal: ${req.headers['x-admin-portal'] === 'true' ? 'YES' : 'NO'}`)

  if (!identifier || !code) {
    console.log('   ❌ Missing identifier or code')
    return res.status(400).json({ error: 'Missing identifier or code.' })
  }

  // Verify via our own in-memory otpStore
  // If it's an admin portal login, keep the OTP alive for the next step (PIN verification)
  const isAdminPortal = req.headers['x-admin-portal'] === 'true'
  const { valid, error } = verifyOTP(identifier, code, isAdminPortal)

  if (!valid) {
    console.log(`   ❌ OTP invalid: ${error}`)
    return res.status(401).json({ error })
  }

  // ── SECURITY GATE: Block suspended/disabled/deactivated accounts at verify ──
  // Super Admin is always exempt from this check
  if (!isAdminPortal) {
    const accountUser = await getAccountStatus(identifier)
    const isSuperAdmin = accountUser?.role === 'super_admin'
    if (!isSuperAdmin && accountUser && BLOCKED_ACCOUNT_STATUSES.has((accountUser.status || '').toLowerCase())) {
      console.log(`   ⛔ OTP VERIFY BLOCKED — Account suspended: ${identifier} (status=${accountUser.status})`)
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        error: 'Your account has been suspended or deactivated by administration. Please contact support.'
      })
    }
  }

  console.log('   ✅ OTP verified OK')
  // NOTE: We don't issue the JWT here for the admin portal anymore.
  // The frontend must call /api/otp/verify-pin in the next step.
  return res.json({ success: true, verified: true, identifier, type: type || 'phone' })
})

// ─── Verify PIN & Issue JWT ───────────────────────────────
app.post('/api/otp/verify-pin', otpRateLimitMiddleware, async (req, res) => {
  const { identifier, code, pin, type } = req.body

  if (!identifier || !code || !pin) {
    return res.status(400).json({ error: 'Missing identifier, code, or pin.' })
  }

  // 1. Verify OTP is still valid, but keep it alive until PIN is confirmed
  const { valid, error } = verifyOTP(identifier, code, true)
  if (!valid) {
    return res.status(401).json({ error: 'OTP expired or invalid. Please request a new one.' })
  }

  if (req.headers['x-admin-portal'] === 'true') {
    let adminUser
    try {
      adminUser = await isSuperAdminOrAdmin(identifier, null, true)
    } catch (err) {
      console.error('Error verifying admin status:', err)
      return res.status(500).json({ error: 'Failed to verify admin status.' })
    }
    
    if (!adminUser || (adminUser.status === 'disabled' || adminUser.status === 'suspended')) {
      return res.status(403).json({ error: 'Admin account not found or suspended.' })
    }

    // 2. Verify PIN
    try {
      const url = `${process.env.SUPABASE_URL}/rest/v1/users?select=id,role,status,pin_hash&id=eq.${adminUser.id}`
      const userRes = await fetch(url, {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      })
      if (userRes.ok) {
        const users = await userRes.json()
        const dbUser = users[0]
        // ── SECURITY GATE: Remove static PIN bypass ──
        if (dbUser && dbUser.pin_hash && dbUser.pin_hash !== pin) {
           return res.status(401).json({ error: 'Incorrect PIN.' })
        }
      }
    } catch(err) {
      console.error('Error verifying pin:', err)
      return res.status(500).json({ error: 'Failed to verify PIN.' })
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
      console.error("Missing SUPABASE_JWT_SECRET in API env!")
      return res.status(500).json({ error: 'Server misconfiguration.' })
    }

    // Login successful, atomically consume the OTP
    if (!consumeOTP(identifier, code)) {
      return res.status(401).json({ error: 'OTP has already been used or expired.' })
    }

    // Sign 15-minute Access JWT
    const accessToken = jwt.sign(
      {
        sub: adminUser.id,
        role: 'authenticated', // Matches Supabase's expected Postgres role
        app_metadata: { role: adminUser.role } // This is what RLS get_my_role() reads
      },
      process.env.SUPABASE_JWT_SECRET,
      { expiresIn: '15m', audience: 'authenticated' }
    )

    // Sign 1-hour Refresh Token (absolute session limit)
    const refreshToken = jwt.sign(
      { sub: adminUser.id, identifier },
      process.env.SUPABASE_JWT_SECRET,
      { expiresIn: '1h' }
    )

    // Set HttpOnly, Secure cookie
    res.cookie('admin_refresh_token', refreshToken, {
      httpOnly: true,
      secure: true, // must be true for sameSite: 'none'
      sameSite: 'none',
      path: '/api/otp/refresh',
      maxAge: 60 * 60 * 1000 // 1 hour absolute limit
    })

    return res.json({ 
      success: true, 
      verified: true,
      identifier, 
      type: type || 'phone',
      session: {
        access_token: accessToken,
        user: adminUser
      }
    })
  }

  return res.status(400).json({ error: 'Invalid request context.' })
})

// ─── Refresh Token ──────────────────────────────────────────
app.post('/api/otp/refresh', otpRateLimitMiddleware, async (req, res) => {
  const token = req.cookies.admin_refresh_token

  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided.' })
  }

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET)
    
    // Re-verify against database
    let adminUser
    try {
      adminUser = await isSuperAdminOrAdmin(decoded.identifier, null, true)
    } catch (dbErr) {
      console.error('DB Error during refresh:', dbErr)
      return res.status(500).json({ error: 'Database error verifying admin status.' })
    }

    if (!adminUser || (adminUser.status === 'disabled' || adminUser.status === 'suspended')) {
      res.clearCookie('admin_refresh_token', { path: '/api/otp/refresh' })
      return res.status(403).json({ error: 'Account revoked or suspended.' })
    }

    // Issue new 15-min access token
    const accessToken = jwt.sign(
      {
        sub: adminUser.id,
        role: 'authenticated', // Matches Supabase's expected Postgres role
        app_metadata: { role: adminUser.role }
      },
      process.env.SUPABASE_JWT_SECRET,
      { expiresIn: '15m', audience: 'authenticated' }
    )

    return res.json({
      success: true,
      session: {
        access_token: accessToken,
        user: adminUser
      }
    })

  } catch (err) {
    res.clearCookie('admin_refresh_token', { path: '/api/otp/refresh' })
    return res.status(401).json({ error: 'Invalid or expired refresh token.' })
  }
})

// ─── Logout ─────────────────────────────────────────────────
app.post('/api/otp/logout', (req, res) => {
  res.clearCookie('admin_refresh_token', { path: '/api/otp/refresh' })
  return res.json({ success: true, message: 'Logged out successfully.' })
})

// ─── Update/Reset PIN (OTP-Protected) ──────────────────────
app.post('/api/otp/update-pin', async (req, res) => {
  const { identifier, code, newPin, type } = req.body

  if (!identifier || !code || !newPin) {
    return res.status(400).json({ error: 'Missing identifier, OTP code, or new PIN.' })
  }

  const cleanPin = String(newPin).trim()
  if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
    return res.status(400).json({ error: 'New PIN must be exactly 6 numeric digits.' })
  }

  // 1. Verify OTP
  const { valid, error } = verifyOTP(identifier, code)
  if (!valid) {
    return res.status(401).json({ error: error || 'Invalid or expired OTP.' })
  }

  // 2. Update Supabase users table
  const cleanId = String(identifier).trim().toLowerCase()
  const cleanPhone = String(identifier).replace(/\D/g, '').slice(-10)

  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const url = `${process.env.SUPABASE_URL}/rest/v1/users?or=(email.eq.${encodeURIComponent(cleanId)},phone.ilike.*${cleanPhone}*)`
      const updateRes = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ pin_hash: cleanPin })
      })

      if (!updateRes.ok) {
        const errText = await updateRes.text()
        return res.status(500).json({ error: 'Failed to update PIN in database: ' + errText })
      }

      const updated = await updateRes.json()
      return res.json({
        success: true,
        message: 'Security PIN successfully updated!',
        user: updated?.[0] || null
      })
    } catch (e) {
      return res.status(500).json({ error: 'Database update failed: ' + e.message })
    }
  }

  return res.json({ success: true, message: 'PIN updated successfully.' })
})

// ─── Send Admin Welcome / Onboarding Email ─────────────────
app.post('/api/admin/send-welcome', async (req, res) => {
  const { email, name, pin, phone, role } = req.body

  if (!email || !pin) {
    return res.status(400).json({ error: 'Email and PIN are required.' })
  }

  const result = await sendAdminWelcomeEmail({
    toEmail: email.trim().toLowerCase(),
    name: name?.trim(),
    pin: String(pin).trim(),
    phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : undefined,
    role: role || 'Administrator'
  })

  if (!result.success) {
    return res.status(500).json({ error: result.error || 'Failed to send welcome email.' })
  }

  return res.json({ success: true, message: `Welcome email with login credentials sent to ${email}` })
})

// ─── Resend OTP ───────────────────────────────────────────
app.post('/api/otp/resend', otpRateLimitMiddleware, async (req, res) => {
  const { identifier, type } = req.body

  if (!identifier || !type) {
    return res.status(400).json({ error: 'Missing identifier or type.' })
  }

  // Generate a new OTP using our internal store
  const { code, error: otpError } = setOTP(identifier)
  if (otpError) {
    return res.status(429).json({ error: otpError })
  }

  if (type === 'phone') {
    const cleanPhone = identifier.replace(/\D/g, '').slice(-10)
    const result = await sendSmsOTP(cleanPhone, code)
    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }
    return res.json({ success: true, message: 'OTP resent via SMS.' })

  } else if (type === 'email') {
    const result = await sendEmailOTP(identifier, code)
    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }
    return res.json({ success: true, message: 'OTP resent via Email.' })

  } else {
    return res.status(400).json({ error: 'Type must be "email" or "phone".' })
  }
})

// (Removed SMS Notification endpoint as per user preference)


// ─── Notify Customer on Worker Assignment ─────────────────
app.post('/api/notify/customer-assigned', async (req, res) => {
  const { customerEmail, customerName, serviceName, jobId, workerName, workerPhone, area, address, preferredTime, trackingUrl } = req.body

  if (!customerEmail) {
    return res.status(400).json({ error: 'Missing customerEmail.' })
  }

  const cleanPhone = workerPhone ? String(workerPhone).replace(/\D/g, '').slice(-10) : ''
  const formattedPhone = cleanPhone ? `+91 ${cleanPhone}` : 'Contact Support'
  const callLink = cleanPhone ? `tel:+91${cleanPhone}` : ''

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 26px; font-weight: 800;">🔧 MistriJi</h1>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0; font-weight: 500;">Jammu's Trusted Home Service Workers</p>
      </div>

      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 20px; text-align: center; color: #ffffff; margin-bottom: 24px;">
        <div style="font-size: 28px; margin-bottom: 6px;">👷</div>
        <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Worker Assigned to Your Request!</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">A verified professional is ready to attend to your service.</p>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 13px; font-weight: 600;">Booking ID: </span>
          <strong style="color: #1e1b4b; font-family: monospace; font-size: 14px;">${jobId || 'N/A'}</strong>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #64748b; font-size: 13px; font-weight: 600;">Service: </span>
          <strong style="color: #1e1b4b; font-size: 14px;">${serviceName || 'Home Service'}</strong>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #64748b; font-size: 13px; font-weight: 600;">Location: </span>
          <span style="color: #334155; font-size: 13px;">${area ? `${area}${address ? `, ${address}` : ''}` : 'Jammu'}</span>
        </div>

        ${preferredTime ? `
          <div style="margin-bottom: 10px;">
            <span style="color: #64748b; font-size: 13px; font-weight: 600;">Preferred Slot: </span>
            <span style="color: #334155; font-size: 13px;">${preferredTime}</span>
          </div>
        ` : ''}
      </div>

      <!-- Assigned Technician Card -->
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <div style="color: #047857; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          Assigned Professional
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #064e3b; margin-bottom: 8px;">
          ${workerName || 'Mistri Assigned Worker'}
        </div>
        <div style="margin-top: 10px;">
          <div style="color: #166534; font-size: 15px; font-weight: 700; margin-bottom: 8px;">
            📞 ${formattedPhone}
          </div>
          ${callLink ? `
            <a href="${callLink}" style="background: #059669; color: #ffffff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block;">
              Call Worker Now
            </a>
          ` : ''}
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${trackingUrl || 'http://localhost:3000/my-bookings'}" style="background: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 800; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
          Track Booking Live →
        </a>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 12px; color: #92400e; line-height: 1.5;">
        💡 <strong>Note:</strong> The technician will reach out to you prior to arrival. If you have any questions or need to reschedule, you can contact them directly or chat with MistriJi support.
      </div>

      <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        © ${new Date().getFullYear()} MistriJi — Jammu & Kashmir Local Services Platform
      </p>
    </div>
  `

  const result = await sendEmailNotification(
    customerEmail.trim(),
    `Worker Assigned: ${serviceName || 'Service Request'} (${jobId || 'MST'}) - MistriJi`,
    html
  )

  if (!result.success) {
    return res.status(500).json({ error: 'Failed to send assignment notification email.' })
  }

  return res.json({ success: true, message: `Notification email sent to customer at ${customerEmail}` })
})

// ─── Error Monitoring Endpoint ──────────────────────────────
app.post('/api/errors/log', async (req, res) => {
  const { message, stack, endpoint, status, browser, appVersion, userId, userRole } = req.body
  await logError({
    message: message || 'Unknown client error',
    stack,
    endpoint: endpoint || 'frontend',
    severity: 'error',
    status: status || 500,
    userId,
    userRole,
    browser,
    appVersion
  })
  res.json({ success: true })
})

// ─── Admin Session Revocation ─────────────────────────────
app.post('/api/admin/revoke-session', async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      // First, check the user's role to prevent suspending a super_admin
      const userRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?select=role&id=eq.${userId}`, {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      })
      
      if (userRes.ok) {
        const users = await userRes.json()
        if (users && users.length > 0 && users[0].role === 'super_admin') {
          return res.status(403).json({ error: 'Cannot revoke session or suspend a super_admin account.' })
        }
      }

      // Deletes all sessions for the user using Supabase Admin Auth API (global signOut)
      const url = `${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`
      const deleteRes = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      if (!deleteRes.ok) {
        console.error('Revoke session failed:', await deleteRes.text())
      }
      return res.json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  return res.status(500).json({ error: 'Supabase configuration missing' })
})

// ─── Global Error Handler ─────────────────────────────────
app.use(async (err, req, res, next) => {
  console.error('[Global Error]', err)
  
  await logError({
    message: err.message,
    stack: err.stack,
    endpoint: req.originalUrl,
    severity: 'critical',
    status: err.status || 500,
  })

  res.status(err.status || 500).json({ error: 'Internal Server Error', message: err.message, stack: err.stack })
})

// ─── Start Server ─────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log(`  ║  🔧 MistriJi Auth API running on port ${PORT}   ║`)
  console.log('  ╠══════════════════════════════════════════════╣')
  console.log(`  ║  Email:  ${process.env.SMTP_EMAIL ? '✅ ' + process.env.SMTP_EMAIL : '❌ Not configured'}`)
  console.log(`  ║  SMS:    ${process.env.FAST2SMS_API_KEY ? '✅ Fast2SMS Smart OTP ready' : '❌ Not configured'}`)
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Killing old process and retrying in 1s...\n`)
    const { execSync } = require('child_process')
    try {
      if (process.platform === 'win32') {
        execSync(`FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${PORT}') DO TaskKill /PID %P /F`, { shell: 'cmd.exe' })
      } else {
        execSync(`lsof -ti tcp:${PORT} | xargs kill -9`)
      }
    } catch (_) {}
    setTimeout(() => server.listen(PORT), 1000)
  } else {
    throw err
  }
})
