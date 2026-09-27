const https = require('https')
const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

async function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': method === 'POST' ? 'return=representation' : '',
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null })
        } catch (e) {
          resolve({ status: res.statusCode, data: null })
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function run() {
  console.log('Setting up worker and customer emails...')

  // 1. Worker
  const workerEmail = 'hafezzargar987+wo@gmail.com'
  let res = await apiRequest('GET', `/rest/v1/users?email=eq.${encodeURIComponent(workerEmail)}`)
  let workerId = res.data && res.data[0] ? res.data[0].id : null

  if (workerId) {
    console.log('Worker user found, updating role to worker...')
    await apiRequest('PATCH', `/rest/v1/users?id=eq.${workerId}`, { role: 'worker' })
  } else {
    console.log('Worker user not found, creating...')
    res = await apiRequest('POST', `/rest/v1/users`, [{
      email: workerEmail,
      role: 'worker',
      status: 'active'
    }])
    workerId = res.data[0].id
    await apiRequest('POST', `/rest/v1/profiles`, [{
      user_id: workerId,
      name: 'Hafez Worker',
      area: 'Gandhi Nagar',
      city: 'Jammu'
    }])
    await apiRequest('POST', `/rest/v1/worker_profiles`, [{
      user_id: workerId,
      experience_years: 5,
      is_available: true,
      verification_status: 'verified'
    }])
  }

  // 2. Customer
  const customerEmail = 'hafezzargar987+cu@gmail.com'
  res = await apiRequest('GET', `/rest/v1/users?email=eq.${encodeURIComponent(customerEmail)}`)
  let customerId = res.data && res.data[0] ? res.data[0].id : null

  if (customerId) {
    console.log('Customer user found, ensuring role is customer...')
    await apiRequest('PATCH', `/rest/v1/users?id=eq.${customerId}`, { role: 'customer' })
  } else {
    console.log('Customer user not found, creating...')
    res = await apiRequest('POST', `/rest/v1/users`, [{
      email: customerEmail,
      role: 'customer',
      status: 'active'
    }])
    customerId = res.data[0].id
    await apiRequest('POST', `/rest/v1/profiles`, [{
      user_id: customerId,
      name: 'Hafez Customer',
      area: 'Gandhi Nagar',
      city: 'Jammu'
    }])
  }

  console.log('Done!')
}

run()
