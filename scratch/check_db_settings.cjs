const https = require('https')
const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

function querySettings() {
  const url = `${SUPABASE_URL}/rest/v1/system_settings?select=*`
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
      console.log('Status:', res.statusCode)
      console.log('Body:', body)
    })
  })

  req.on('error', (err) => console.error('Req error:', err))
  req.end()
}

querySettings()
