const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      DROP POLICY IF EXISTS "users: select" ON public.users;
      CREATE POLICY "users: select" ON public.users FOR SELECT USING (TRUE);
    `
  });
  console.log(error || 'Success');
}

fix();
