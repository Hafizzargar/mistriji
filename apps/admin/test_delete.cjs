const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://ptvfidufwlswbjgsjvzl.supabase.co', 
  'sb_publishable_kckNPRr3_XKHhGhjS3Jccw_jl7z8XSs'
);

async function testDelete() {
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: 'admin@mistriji.com',
    password: 'admin'
  });
  if (authErr) return console.log('Auth error', authErr);

  const { data: job } = await sb.from('jobs').select('*').limit(1);
  if (!job || job.length === 0) return console.log('No jobs found');
  console.log('Testing delete job ID:', job[0].id);
  
  const { error } = await sb.from('jobs').delete().eq('id', job[0].id);
  console.log('Delete error:', error);
}

testDelete();
