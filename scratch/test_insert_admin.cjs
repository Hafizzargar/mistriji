const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

async function testInsert() {
  const payload = {
    phone: null,
    email: 'hamidzargar200@gmail.com',
    role: 'admin',
    status: 'active',
    pin_hash: '123456'
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  })

  const data = await res.json()
  console.log('Status:', res.status)
  console.log('Response:', data)
}

testInsert()
