const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('../../scratch/config.cjs');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const sql = `
    DROP POLICY IF EXISTS "profiles: insert" ON public.profiles;
    CREATE POLICY "profiles: insert" ON public.profiles FOR INSERT WITH CHECK (TRUE);

    DROP POLICY IF EXISTS "profiles: update" ON public.profiles;
    CREATE POLICY "profiles: update" ON public.profiles FOR UPDATE USING (TRUE);

    DROP POLICY IF EXISTS "users: update" ON public.users;
    CREATE POLICY "users: update" ON public.users FOR UPDATE USING (TRUE);
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  console.log('RPC execution result:', error);
}

run();
