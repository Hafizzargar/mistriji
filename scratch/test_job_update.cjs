const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: job, error: jobErr } = await supabase.from('jobs').select('*').limit(1);
  if (jobErr) return console.error('Job Fetch Error:', jobErr);
  
  if (!job.length) return console.log('No jobs found');
  
  const jobId = job[0].id;
  const { data, error } = await supabase.from('jobs').update({ worker_id: null }).eq('id', jobId);
  if (error) {
    console.error('Update Error:', error);
  } else {
    console.log('Update Success!');
  }
}
test();
