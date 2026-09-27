require('dotenv').config({ path: '../../.env' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
async function test() {
  const q = 'Dummy'
  const { data: profileMatches, error: e1 } = await supabase.from('profiles').select('id').ilike('name', `%${q}%`)
  console.log('profileMatches:', profileMatches, e1)
  const profileIds = (profileMatches || []).map(p => p.id)
  const idFilter = profileIds.length > 0 ? `id.in.(${profileIds.join(',')}),` : ''
  console.log('idFilter:', idFilter)
  const { data, error } = await supabase.from('users').select('id, phone, email, role, profiles(name)').or(`${idFilter}phone.ilike.%${q}%,email.ilike.%${q}%`)
  console.log('Users:', data, error)
}
test()
