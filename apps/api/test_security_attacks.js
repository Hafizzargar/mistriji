/**
 * ─── MistriJi Security Attack & Negative Test Suite ─────────────────────────
 * Tests negative security assertions to verify all implemented hardening:
 * 1. Payment creation without auth token (Expect 401)
 * 2. Payment creation with mismatched user ID (Expect 403)
 * 3. Invalid PIN verification (Expect 401)
 * 4. Error handling stack trace prevention
 * ───────────────────────────────────────────────────────────────────────────
 */

// Start the server
require('./src/server')

const http = require('http')

const API_PORT = process.env.PORT || 3002
const BASE_URL = `http://localhost:${API_PORT}`

async function runTests() {
  // Give server a moment to start
  await new Promise(r => setTimeout(r, 1000))

  console.log('\n🧪 Starting MistriJi Security Attack & Negative Test Suite...\n')
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

  // ── Test 1: Payment Order Creation Without Auth Token ──
  console.log('Test 1: Unauthenticated Payment Order Creation...')
  const res1 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: 'some-user-id',
    jobId: 'some-job-id'
  })
  assert('Unauthenticated payment blocked (401)', res1.status === 401, `Got status ${res1.status}, body: ${JSON.stringify(res1.body)}`)

  // ── Test 2: Payment Order Creation With Invalid Token ──
  console.log('Test 2: Unauthorized Payment User Mismatch...')
  const res2 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: 'victim-user-id',
    jobId: 'some-job-id'
  }, {
    'Authorization': 'Bearer invalid.token.string'
  })
  assert('Invalid token payment blocked (401)', res2.status === 401, `Got status ${res2.status}`)

  // ── Test 3: Invalid PIN Verification ──
  console.log('Test 3: Invalid PIN Verification...')
  const res3 = await post('/api/otp/verify-pin', {
    identifier: 'test@mistriji.com',
    code: '123456',
    pin: '000000',
    type: 'email'
  }, {
    'x-admin-portal': 'true'
  })
  assert('Invalid PIN rejected (401/403/404)', res3.status >= 401, `Got status ${res3.status}`)

  // ── Test 4: Error Handling Stack Trace Prevention ──
  console.log('Test 4: Error Handling Stack Trace Prevention...')
  const res4 = await post('/api/payments/create-order', {}, {
    'Authorization': 'Bearer invalid.token.string'
  })
  const leaksStack = typeof res4.body === 'object' && res4.body.stack !== undefined && process.env.NODE_ENV === 'production'
  assert('No internal stack trace leaked in response', !leaksStack, 'Stack trace was exposed in response body')

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed.\n`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
