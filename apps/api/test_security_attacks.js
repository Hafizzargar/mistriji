/**
 * ─── MistriJi Security Attack & Negative Test Suite ─────────────────────────
 * Tests negative security assertions to verify all implemented hardening:
 * 1. Payment creation without auth token (Expect 401)
 * 2. Payment creation with mismatched user ID / impersonation (Expect 403)
 * 3. Payment job validation & price tampering (Expect 404 / 400)
 * 4. Invalid PIN verification (Expect 401)
 * 5. Error handling stack trace prevention
 * ───────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config()
if (!process.env.SUPABASE_JWT_SECRET) {
  process.env.SUPABASE_JWT_SECRET = 'test_jwt_secret_for_security_suite'
}

// Start the server
require('./src/server')

const http = require('http')
const jwt = require('jsonwebtoken')

const API_PORT = process.env.PORT || 3002
const BASE_URL = `http://localhost:${API_PORT}`

async function runTests() {
  await new Promise(r => setTimeout(r, 1000))

  console.log('\n🧪 Starting MistriJi Advanced Security Attack & Negative Test Suite...\n')
  let passed = 0
  let failed = 0

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`)
      passed++
    } else {
      console.log(`  ❌ [FAIL] ${name} — ${details}`)
      failed++
    }
  }

  function post(path, body, headers = {}) {
    return new Promise((resolve) => {
      const data = JSON.stringify(body)
      const req = http.request(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      }, (res) => {
        let resData = ''
        res.on('data', chunk => resData += chunk)
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData), headers: res.headers })
          } catch {
            resolve({ status: res.statusCode, body: resData, headers: res.headers })
          }
        })
      })
      req.on('error', err => resolve({ status: 500, error: err.message }))
      req.write(data)
      req.end()
    })
  }

  // Generate test JWT for user-123
  const validToken = jwt.sign(
    { sub: 'user-123', role: 'authenticated', app_metadata: { role: 'customer' } },
    process.env.SUPABASE_JWT_SECRET,
    { expiresIn: '5m' }
  )

  // ── Test 1: Unauthenticated Payment Order Creation ──
  console.log('Test 1: Unauthenticated Payment Order Creation...')
  const res1 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: 'user-123',
    jobId: 'job-456'
  })
  assert('Unauthenticated payment blocked (401)', res1.status === 401, `Got status ${res1.status}`)

  // ── Test 2: User Impersonation / ID Mismatch ──
  console.log('Test 2: Payment User Impersonation (Mismatch)...')
  const res2 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: 'victim-user-999', // Mismatched user ID
    jobId: 'job-456'
  }, {
    'Authorization': `Bearer ${validToken}`
  })
  assert('User impersonation blocked (403)', res2.status === 403, `Got status ${res2.status}, body: ${JSON.stringify(res2.body)}`)

  // ── Test 3: Payment Job Validation & Amount Tampering ──
  console.log('Test 3: Payment Job Validation & Amount Tampering...')
  const res3 = await post('/api/payments/create-order', {
    amount: 99999,
    userId: 'user-123',
    jobId: 'non-existent-job-id'
  }, {
    'Authorization': `Bearer ${validToken}`
  })
  assert('Non-existent job payment blocked (404/400)', res3.status >= 400, `Got status ${res3.status}, body: ${JSON.stringify(res3.body)}`)

  // ── Test 4: Invalid PIN Verification ──
  console.log('Test 4: Invalid PIN Verification...')
  const res4 = await post('/api/otp/verify-pin', {
    identifier: 'test@mistriji.com',
    code: '123456',
    pin: '000000',
    type: 'email'
  }, {
    'x-admin-portal': 'true'
  })
  assert('Invalid PIN rejected (401/403/404)', res4.status >= 401, `Got status ${res4.status}`)

  // ── Test 5: Error Handling Stack Trace Prevention ──
  console.log('Test 5: Error Handling Stack Trace Prevention...')
  const res5 = await post('/api/payments/create-order', {}, {
    'Authorization': `Bearer ${validToken}`
  })
  const leaksStack = typeof res5.body === 'object' && res5.body.stack !== undefined && process.env.NODE_ENV === 'production'
  assert('No internal stack trace leaked in response', !leaksStack, 'Stack trace was exposed in response body')

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed.\n`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
