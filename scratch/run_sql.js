const postgres = require('postgres');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '../apps/api/.env' });

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  const script = fs.readFileSync('fix_audit_logs.sql', 'utf8');
  try {
    await sql.unsafe(script);
    console.log('SQL applied successfully');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await sql.end();
  }
}
run();
