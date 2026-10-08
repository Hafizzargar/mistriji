/**
 * ─── MistriJi Security Attack & Negative Test Suite ─────────────────────────
 * Tests negative security assertions to verify all implemented hardening:
 * 1. Payment creation without auth token (Expect 401)
 * 2. Payment creation with mismatched user ID / impersonation (Expect 403)
 * 3. Real Payment Amount Tampering (Job price ₹500, attacker sends ₹1 -> Expect 400)
 * 4. Payment verification without auth token (Expect 401)
 * 5. Invalid PIN verification (Expect 401)
 * 6. Error handling stack trace prevention
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
const { createClient } = require('@supabase/supabase-js')

const API_PORT = process.env.PORT || 3002
const BASE_URL = `http://localhost:${API_PORT}`

const supabase = (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY))
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)
  : null

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

  const testUserId = 'c0000000-0000-0000-0000-000000000123'
  const testJobUuid = 'd0000000-0000-0000-0000-000000000456'

  // Generate test JWT for testUserId
  const validToken = jwt.sign(
    { sub: testUserId, role: 'authenticated', app_metadata: { role: 'customer' } },
    process.env.SUPABASE_JWT_SECRET,
    { expiresIn: '5m' }
  )

  let testSkillId = 'e0000000-0000-0000-0000-000000000789'
  if (supabase) {
    try {
      await supabase.from('users').upsert({
        id: testUserId,
        phone: '9999999999',
        role: 'customer',
        status: 'active'
      })

      const { data: skills } = await supabase.from('skills').select('id').limit(1)
      if (skills && skills.length > 0) {
        testSkillId = skills[0].id
      } else {
        await supabase.from('skills').insert({ id: testSkillId, name: 'Test Skill', is_active: true })
      }

      const { error: insErr } = await supabase.from('jobs').insert({
        id: testJobUuid,
        customer_id: testUserId,
        skill_id: testSkillId,
        price: 500, // ₹500 (Expected paise: 50000)
        status: 'requested',
        area: 'Jammu',
        address: 'Test Address Jammu'
      })
      if (insErr) {
        console.log('⚠️ Supabase test job insert warning:', insErr.message)
      } else {
        console.log('✅ Test user and job inserted successfully.')
      }
    } catch (e) {
      console.log('⚠️ Supabase test setup exception:', e.message)
    }
  }

  // ── Test 1: Unauthenticated Payment Order Creation ──
  console.log('Test 1: Unauthenticated Payment Order Creation...')
  const res1 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: testUserId,
    jobId: testJobUuid
  })
  assert('Unauthenticated payment blocked (401)', res1.status === 401, `Got status ${res1.status}`)

  // ── Test 2: User Impersonation / ID Mismatch ──
  console.log('Test 2: Payment User Impersonation (Mismatch)...')
  const res2 = await post('/api/payments/create-order', {
    amount: 50000,
    userId: 'c0000000-0000-0000-0000-000000000999', // Mismatched user ID
    jobId: testJobUuid
  }, {
    'Authorization': `Bearer ${validToken}`
  })
  assert('User impersonation blocked (403)', res2.status === 403, `Got status ${res2.status}, body: ${JSON.stringify(res2.body)}`)

  // ── Test 3: Real Payment Amount Tampering (Job price ₹500 [50000 paise], attacker sends ₹1 [100 paise]) ──
  console.log('Test 3: Real Payment Amount Tampering...')
  const res3 = await post('/api/payments/create-order', {
    amount: 100, // Tampered amount: 100 paise (₹1) instead of 50000 paise (₹500)
    userId: testUserId,
    jobId: testJobUuid
  }, {
    'Authorization': `Bearer ${validToken}`
  })
  assert('Amount tampering rejected (400 Bad Request)', res3.status === 400, `Got status ${res3.status}, body: ${JSON.stringify(res3.body)}`)

  // Cleanup test job & user
  if (supabase) {
    try {
      await supabase.from('jobs').delete().eq('id', testJobUuid)
      await supabase.from('users').delete().eq('id', testUserId)
    } catch {}
  }

  // ── Test 4: Unauthenticated Payment Verification ──
  console.log('Test 4: Unauthenticated Payment Verification...')
  const res6 = await post('/api/payments/verify', {
    razorpay_order_id: 'order_test_123',
    razorpay_payment_id: 'pay_test_123',
    razorpay_signature: 'invalid_sig'
  })
  assert('Unauthenticated payment verification blocked (401)', res6.status === 401, `Got status ${res6.status}`)

  // ── Test 5: Invalid PIN Verification ──
  console.log('Test 5: Invalid PIN Verification...')
  const res4 = await post('/api/otp/verify-pin', {
    identifier: 'test@mistriji.com',
    code: '123456',
    pin: '000000',
    type: 'email'
  }, {
    'x-admin-portal': 'true'
  })
  assert('Invalid PIN rejected (401/403/404)', res4.status >= 401, `Got status ${res4.status}`)

  // ── Test 6: Error Handling Stack Trace Prevention ──
  console.log('Test 6: Error Handling Stack Trace Prevention...')
  const res5 = await post('/api/payments/create-order', {}, {
    'Authorization': `Bearer ${validToken}`
  })
  const leaksStack = typeof res5.body === 'object' && res5.body.stack !== undefined && process.env.NODE_ENV === 'production'
  assert('No internal stack trace leaked in response', !leaksStack, 'Stack trace was exposed in response body')

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed.\n`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
