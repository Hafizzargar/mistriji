const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '../apps/admin/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data } = await supabase.from('profiles').select('*').ilike('name', '%Customtggy%');
  console.log('Profile:', data);
}

main();
