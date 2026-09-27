const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

async function test() {
  console.log('Testing system_settings query...')
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  
  if (res.ok) {
    console.log('Data:', await res.json())
  } else {
    console.log('Error:', await res.text())
  }
}

test()
