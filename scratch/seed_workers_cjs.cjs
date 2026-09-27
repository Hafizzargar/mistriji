// CommonJS seed script for J&K workers
// Run from: node scratch/seed_workers_cjs.cjs

const https = require('https')
const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

const DUMMY_WORKERS = [
  { name: 'Tariq Ahmed',      phone: '9858000001', area: 'Bhaderwah',    lat: 32.9810, lng: 75.7120, experience_years: 8,  skills: ['Electrician', 'Plumber'],            rating: 5, comment: 'Exceptional electrical wiring work in Bhaderwah bazaar!' },
  { name: 'Vikram Singh',     phone: '9858000002', area: 'Doda',         lat: 33.1450, lng: 75.5460, experience_years: 6,  skills: ['Mason', 'Carpenter'],                rating: 5, comment: 'Great masonry & stone work construction in Doda.' },
  { name: 'Sunil Kumar',      phone: '9858000003', area: 'Katra',        lat: 32.9910, lng: 74.9310, experience_years: 5,  skills: ['AC Technician', 'Electrician'],      rating: 5, comment: 'Fixed hotel AC unit in Katra fast and efficiently.' },
  { name: 'Mohammad Ashraf',  phone: '9858000004', area: 'Udhampur',     lat: 32.9260, lng: 75.1410, experience_years: 10, skills: ['Painter', 'House Cleaning'],         rating: 5, comment: 'Excellent house painting and deep cleaning in Udhampur town.' },
  { name: 'Ghulam Hassan',    phone: '9858000005', area: 'Srinagar',     lat: 34.0837, lng: 74.7973, experience_years: 12, skills: ['Carpenter', 'Painter'],              rating: 5, comment: 'Expert wood carving and timber fitting in Lal Chowk Srinagar.' },
  { name: 'Shabir Ahmed Bhat',phone: '9858000006', area: 'Anantnag',     lat: 33.7310, lng: 75.1480, experience_years: 7,  skills: ['Plumber', 'Electrician'],            rating: 5, comment: 'Super fast plumbing leak repair in Anantnag.' },
  { name: 'Bilal Ahmed',      phone: '9858000007', area: 'Baramulla',    lat: 34.2010, lng: 74.3420, experience_years: 4,  skills: ['Mason', 'Helper'],                   rating: 4, comment: 'Hardworking helper and brick mason in Baramulla.' },
  { name: 'Ramesh Sharma',    phone: '9858000008', area: 'Gandhi Nagar', lat: 32.7081, lng: 74.8711, experience_years: 9,  skills: ['Electrician', 'AC Technician'],      rating: 5, comment: 'Very professional electrician in Gandhi Nagar Jammu.' },
  { name: 'Rakesh Kumar',     phone: '9858000009', area: 'Satwari',      lat: 32.6890, lng: 74.8450, experience_years: 11, skills: ['Plumber'],                            rating: 5, comment: 'Top quality pipe fitting near Satwari airport.' },
  { name: 'Manzoor Ali',      phone: '9858000010', area: 'Janipur',      lat: 32.7550, lng: 74.8490, experience_years: 6,  skills: ['Mason', 'Carpenter'],                rating: 4, comment: 'Solid carpentry work done near High Court Janipur.' },
  { name: 'Gurdeep Singh',    phone: '9858000011', area: 'RS Pura',      lat: 32.6030, lng: 74.7330, experience_years: 14, skills: ['Welder', 'Mason'],                   rating: 5, comment: 'Heavy welding and iron gate fabrication in RS Pura.' },
  { name: 'Suraj Prakash',    phone: '9858000012', area: 'Kathua',       lat: 32.3710, lng: 75.5210, experience_years: 3,  skills: ['Helper', 'Painter'],                 rating: 4, comment: 'Reliable painter in Kathua town.' },
  { name: 'Anil Gupta',       phone: '9858000013', area: 'Trikuta Nagar',lat: 32.7020, lng: 74.8780, experience_years: 7,  skills: ['Electrician', 'Plumber'],            rating: 5, comment: 'Fast and reliable work in Trikuta Nagar.' },
  { name: 'Riyaz Ahmed',      phone: '9858000014', area: 'Sopore',       lat: 34.3000, lng: 74.4720, experience_years: 5,  skills: ['Mason', 'Carpenter'],                rating: 4, comment: 'Good masonry work in Sopore market area.' },
  { name: 'Deepak Sharma',    phone: '9858000015', area: 'Jewel Chowk',  lat: 32.7270, lng: 74.8570, experience_years: 8,  skills: ['Painter', 'House Cleaning'],         rating: 5, comment: 'Neat and tidy painting in old city Jammu.' },
  { name: 'Mushtaq Ahmad',    phone: '9858000016', area: 'Pulwama',      lat: 33.8720, lng: 74.8950, experience_years: 6,  skills: ['Electrician'],                       rating: 4, comment: 'Dependable electrical work in Pulwama district.' },
  { name: 'Vikas Verma',      phone: '9858000017', area: 'Samba',        lat: 32.5620, lng: 75.1160, experience_years: 9,  skills: ['Mason', 'Welder'],                   rating: 5, comment: 'Strong construction and iron work in Samba.' },
  { name: 'Zahoor Hussain',   phone: '9858000018', area: 'Rajouri',      lat: 33.3810, lng: 74.3120, experience_years: 11, skills: ['Carpenter', 'Painter'],              rating: 5, comment: 'Excellent wooden door and window fitting in Rajouri.' },
  { name: 'Amar Jyoti',       phone: '9858000019', area: 'Bakshi Nagar', lat: 32.7380, lng: 74.8480, experience_years: 4,  skills: ['Helper', 'House Cleaning'],          rating: 4, comment: 'Quick and clean domestic helper near GMC Jammu.' },
  { name: 'Noor Mohammad',    phone: '9858000020', area: 'Anantnag',     lat: 33.7310, lng: 75.1480, experience_years: 13, skills: ['Mason', 'Carpenter'],                rating: 5, comment: 'Expert craftsman in Anantnag for over a decade.' },
]

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
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function seedData() {
  console.log('🌱 Starting J&K workers seed...')

  // 1. Get all skills
  const skillsRes = await apiRequest('GET', '/rest/v1/skills?select=id,name&is_active=eq.true')
  if (!skillsRes.data || skillsRes.data.length === 0) {
    console.error('❌ No skills found in database! Make sure the DB is set up.')
    return
  }

  const skillMap = new Map(skillsRes.data.map(s => [s.name.toLowerCase(), s.id]))
  console.log(`✅ Found ${skillsRes.data.length} skills:`, skillsRes.data.map(s => s.name).join(', '))

  let created = 0
  let skipped = 0

  for (const w of DUMMY_WORKERS) {
    process.stdout.write(`  → ${w.name} (${w.area})... `)

    // Check if user already exists
    const existRes = await apiRequest('GET', `/rest/v1/users?select=id&phone=eq.${w.phone}&limit=1`)
    let userId

    if (existRes.data && existRes.data.length > 0) {
      userId = existRes.data[0].id
      process.stdout.write(`[exists] `)
    } else {
      // Create user
      const userRes = await apiRequest('POST', '/rest/v1/users?select=id', [{
        phone: w.phone,
        role: 'worker',
        status: 'active',
      }])
      if (!userRes.data || userRes.data.length === 0) {
        console.log(`❌ Failed to create user: ${JSON.stringify(userRes)}`)
        skipped++
        continue
      }
      userId = userRes.data[0].id
      process.stdout.write(`[created user] `)
    }

    // Upsert profile
    await apiRequest('POST', '/rest/v1/profiles?on_conflict=user_id', [{
      user_id: userId,
      name: w.name,
      area: w.area,
      city: w.area,
      lat: w.lat,
      lng: w.lng,
    }])

    // Upsert worker profile
    await apiRequest('POST', '/rest/v1/worker_profiles?on_conflict=user_id', [{
      user_id: userId,
      experience_years: w.experience_years,
      is_available: true,
      verification_status: 'verified',
      phone_type: 'smartphone',
      enrollment_method: 'field',
      claimed: true,
      lat: w.lat,
      lng: w.lng,
    }])

    // Upsert worker skills
    for (const skillName of w.skills) {
      const skillId = skillMap.get(skillName.toLowerCase())
      if (skillId) {
        await apiRequest('POST', '/rest/v1/worker_skills?on_conflict=worker_id,skill_id', [{
          worker_id: userId,
          skill_id: skillId,
          experience_years: w.experience_years,
        }])
      } else {
        process.stdout.write(`[skill not found: ${skillName}] `)
      }
    }

    // Create rating if none exists
    const existJobRes = await apiRequest('GET', `/rest/v1/jobs?select=id&worker_id=eq.${userId}&limit=1`)
    if (!existJobRes.data || existJobRes.data.length === 0) {
      // Get first admin user for customer_id
      const adminRes = await apiRequest('GET', '/rest/v1/users?select=id&role=eq.super_admin&limit=1')
      const adminId = adminRes.data && adminRes.data.length > 0 ? adminRes.data[0].id : null

      if (adminId && w.skills.length > 0) {
        const firstSkillId = skillMap.get(w.skills[0].toLowerCase())
        if (firstSkillId) {
          const jobRes = await apiRequest('POST', '/rest/v1/jobs?select=id', [{
            customer_id: adminId,
            worker_id: userId,
            skill_id: firstSkillId,
            status: 'completed',
            address: `${w.area} Main Market, J&K`,
            area: w.area,
            price: 600,
          }])

          if (jobRes.data && jobRes.data.length > 0) {
            await apiRequest('POST', '/rest/v1/ratings', [{
              job_id: jobRes.data[0].id,
              from_user_id: adminId,
              to_user_id: userId,
              score: w.rating,
              comment: w.comment,
            }])
          }
        }
      }
    }

    console.log(`✅`)
    created++
  }

  console.log(`\n🎉 Done! Seeded ${created} workers, skipped ${skipped}.`)
}

seedData().catch(console.error)
