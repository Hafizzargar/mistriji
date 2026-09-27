require('./apps/admin/node_modules/dotenv').config({ path: 'apps/admin/.env' });
const { createClient } = require('./apps/admin/node_modules/@supabase/supabase-js');

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: job } = await sb.from('jobs').select('id').limit(1);
  if (!job || job.length === 0) return console.log('No jobs found');
  const jobId = job[0].id;
  
  console.log('Testing delete on jobId:', jobId);
  const { error } = await sb.from('jobs').delete().eq('id', jobId);
  console.log('Delete Error:', error);
}

check();
