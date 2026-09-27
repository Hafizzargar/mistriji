const https = require('https')
const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

const tables = ['users', 'profiles', 'worker_profiles', 'skills', 'jobs', 'ratings', 'audit_logs', 'system_settings']

for (const tbl of tables) {
  const url = `${SUPABASE_URL}/rest/v1/${tbl}?select=*&limit=1`
  const req = https.request(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let body = ''
    res.on('data', chunk => body += chunk)
    res.on('end', () => {
      console.log(`Table ${tbl}: Status ${res.statusCode} -> ${body.slice(0, 100)}`)
    })
  })
  req.end()
}
