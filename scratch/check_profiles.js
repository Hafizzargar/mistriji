const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profiles schema:", Object.keys(data[0] || {}));
}

checkSchema();
