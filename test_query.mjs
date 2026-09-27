import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
async function test() {
  const q = 'Dummy'
  const { data: profileMatches, error: e1 } = await supabase.from('profiles').select('id').ilike('name', `%${q}%`)
  console.log('profileMatches:', profileMatches, e1)
  const profileIds = (profileMatches || []).map(p => p.id)
  const idFilter = profileIds.length > 0 ? `id.in.(${profileIds.join(',')}),` : ''
  console.log('idFilter:', idFilter)
  const { data, error } = await supabase.from('users').select('id, phone, email, role, profiles(name)').or(`${idFilter}phone.ilike.%${q}%,email.ilike.%${q}%`)
  console.log('Users error:', error)
  console.log('Users length:', data ? data.length : 0)
}
test()
