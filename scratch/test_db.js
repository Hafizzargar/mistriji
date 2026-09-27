const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

async function test() {
  const notif = {
    user_id: '0c9a64e6-7305-4567-bdc3-298995fb342e',
    title: 'Test',
    message: 'Test msg',
    type: 'system'
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(notif)
  })
  
  if (res.ok) {
    console.log('Insert success:', await res.json())
  } else {
    console.log('Insert Error:', await res.text())
  }
}

test()
