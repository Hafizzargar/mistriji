import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DUMMY_WORKERS = [
  // ── DODA & BHADERWAH ────────────────────────────────────────
  {
    name: 'Tariq Ahmed',
    phone: '9858000001',
    area: 'Bhaderwah',
    lat: 32.9810,
    lng: 75.7120,
    experience_years: 8,
    skills: ['Electrician', 'Plumber'],
    rating: 5,
    comment: 'Exceptional electrical wiring work in Bhaderwah bazaar!',
  },
  {
    name: 'Vikram Singh',
    phone: '9858000002',
    area: 'Doda',
    lat: 33.1450,
    lng: 75.5460,
    experience_years: 6,
    skills: ['Mason', 'Carpenter'],
    rating: 5,
    comment: 'Great masonry & stone work construction in Doda.',
  },

  // ── KATRA & UDHAMPUR ────────────────────────────────────────
  {
    name: 'Sunil Kumar',
    phone: '9858000003',
    area: 'Katra',
    lat: 32.9910,
    lng: 74.9310,
    experience_years: 5,
    skills: ['AC Technician', 'Electrician'],
    rating: 5,
    comment: 'Fixed hotel AC unit in Katra fast and efficiently.',
  },
  {
    name: 'Mohammad Ashraf',
    phone: '9858000004',
    area: 'Udhampur',
    lat: 32.9260,
    lng: 75.1410,
    experience_years: 10,
    skills: ['Painter', 'House Cleaning'],
    rating: 5,
    comment: 'Excellent house painting and deep cleaning in Udhampur town.',
  },

  // ── SRINAGAR & KASHMIR VALLEY ──────────────────────────────
  {
    name: 'Ghulam Hassan',
    phone: '9858000005',
    area: 'Srinagar',
    lat: 34.0837,
    lng: 74.7973,
    experience_years: 12,
    skills: ['Carpenter', 'Painter'],
    rating: 5,
    comment: 'Expert wood carving and timber fitting in Lal Chowk Srinagar.',
  },
  {
    name: 'Shabir Ahmed Bhat',
    phone: '9858000006',
    area: 'Anantnag',
    lat: 33.7310,
    lng: 75.1480,
    experience_years: 7,
    skills: ['Plumber', 'Electrician'],
    rating: 5,
    comment: 'Super fast plumbing leak repair in Anantnag.',
  },
  {
    name: 'Bilal Ahmed',
    phone: '9858000007',
    area: 'Baramulla',
    lat: 34.2010,
    lng: 74.3420,
    experience_years: 4,
    skills: ['Mason', 'Helper'],
    rating: 4,
    comment: 'Hardworking helper and brick mason in Baramulla.',
  },

  // ── JAMMU METRO & BORDER TOWNS ─────────────────────────────
  {
    name: 'Ramesh Sharma',
    phone: '9858000008',
    area: 'Gandhi Nagar',
    lat: 32.7081,
    lng: 74.8711,
    experience_years: 9,
    skills: ['Electrician', 'AC Technician'],
    rating: 5,
    comment: 'Very professional electrician in Gandhi Nagar Jammu.',
  },
  {
    name: 'Rakesh Kumar',
    phone: '9858000009',
    area: 'Satwari',
    lat: 32.6890,
    lng: 74.8450,
    experience_years: 11,
    skills: ['Plumber'],
    rating: 5,
    comment: 'Top quality pipe fitting near Satwari airport.',
  },
  {
    name: 'Manzoor Ali',
    phone: '9858000010',
    area: 'Janipur',
    lat: 32.7550,
    lng: 74.8490,
    experience_years: 6,
    skills: ['Mason', 'Carpenter'],
    rating: 4,
    comment: 'Solid carpentry work done near High Court Janipur.',
  },
  {
    name: 'Gurdeep Singh',
    phone: '9858000011',
    area: 'RS Pura',
    lat: 32.6030,
    lng: 74.7330,
    experience_years: 14,
    skills: ['Welder', 'Mason'],
    rating: 5,
    comment: 'Heavy welding and iron gate fabrication in RS Pura.',
  },
  {
    name: 'Suraj Prakash',
    phone: '9858000012',
    area: 'Kathua',
    lat: 32.3710,
    lng: 75.5210,
    experience_years: 3,
    skills: ['Helper', 'Painter'],
    rating: 4,
    comment: 'Reliable painter in Kathua town.',
  },
]

async function seedData() {
  console.log('🌱 Starting dummy J&K workers seed process…')

  // Fetch skill lookup map
  const { data: dbSkills, error: skErr } = await supabase.from('skills').select('id, name')
  if (skErr || !dbSkills) {
    console.error('Error fetching skills:', skErr)
    return
  }

  const skillMap = new Map(dbSkills.map(s => [s.name.toLowerCase(), s.id]))

  for (const w of DUMMY_WORKERS) {
    console.log(`Creating worker: ${w.name} (${w.area})…`)

    // 1. Create or fetch user row
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', w.phone)
      .maybeSingle()

    let userId
    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
          phone: w.phone,
          role: 'worker',
          status: 'active',
        })
        .select('id')
        .single()

      if (uErr) {
        console.error(`User creation error for ${w.name}:`, uErr)
        continue
      }
      userId = newUser.id
    }

    // 2. Profile
    await supabase.from('profiles').upsert({
      user_id: userId,
      name: w.name,
      area: w.area,
      city: w.area,
      lat: w.lat,
      lng: w.lng,
    })

    // 3. Worker Profile
    await supabase.from('worker_profiles').upsert({
      user_id: userId,
      experience_years: w.experience_years,
      is_available: true,
      verification_status: 'verified',
      phone_type: 'smartphone',
      enrollment_method: 'field',
      claimed: true,
      lat: w.lat,
      lng: w.lng,
    })

    // 4. Worker Skills
    for (const skillName of w.skills) {
      const skillId = skillMap.get(skillName.toLowerCase())
      if (skillId) {
        await supabase.from('worker_skills').upsert({
          worker_id: userId,
          skill_id: skillId,
          experience_years: w.experience_years,
        })
      }
    }

    // 5. Create rating & fake completed job if not exists
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('worker_id', userId)
      .maybeSingle()

    if (!existingJob) {
      // Find a customer user (e.g. Super Admin or create guest customer)
      const { data: superAdmin } = await supabase
        .from('users')
        .select('id')
        .limit(1)
        .single()

      if (superAdmin && w.skills.length > 0) {
        const firstSkillId = skillMap.get(w.skills[0].toLowerCase())
        if (firstSkillId) {
          const { data: newJob } = await supabase
            .from('jobs')
            .insert({
              customer_id: superAdmin.id,
              worker_id: userId,
              skill_id: firstSkillId,
              status: 'completed',
              address: `${w.area} Main Market, J&K`,
              area: w.area,
              price: 600,
            })
            .select('id')
            .single()

          if (newJob) {
            await supabase.from('ratings').insert({
              job_id: newJob.id,
              from_user_id: superAdmin.id,
              to_user_id: userId,
              score: w.rating,
              comment: w.comment,
            })
          }
        }
      }
    }
  }

  console.log('✅ Successfully seeded J&K dummy workers across Bhaderwah, Doda, Katra, Udhampur, Srinagar, Anantnag, Baramulla, Jammu, Kathua, RS Pura!')
}

seedData()
