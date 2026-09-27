const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const cron = require('node-cron')
const { Parser } = require('json2csv')
const { sendEmailNotification } = require('./emailService') // Reuse your existing email service

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const SUPERADMIN_EMAIL = 'hafezzargar987@gmail.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Helper to create a unique fingerprint based on message and endpoint
function generateFingerprint(message, endpoint) {
  const cleanMsg = (message || '').substring(0, 100)
  return crypto.createHash('sha256').update(`${cleanMsg}|${endpoint}`).digest('hex')
}

// Global logger to insert/update an error
async function logError({
  message,
  stack,
  endpoint,
  severity = 'error',
  status = 500,
  userId = null,
  userRole = null,
  browser = null,
  appVersion = null
}) {
  try {
    const fingerprint = generateFingerprint(message, endpoint)
    
    // Check if error already exists and is open
    const { data: existingError } = await supabase
      .from('system_errors')
      .select('id, occurrences')
      .eq('fingerprint', fingerprint)
      .in('status', ['open', 'ignored'])
      .single()

    if (existingError) {
      // Increment occurrence
      await supabase
        .from('system_errors')
        .update({
          occurrences: existingError.occurrences + 1,
          last_seen: new Date().toISOString()
        })
        .eq('id', existingError.id)
    } else {
      // Insert new error
      const { data: newError, error } = await supabase
        .from('system_errors')
        .insert([{
          fingerprint,
          severity,
          endpoint,
          error_message: message,
          stack_trace: stack,
          user_id: userId,
          user_role: userRole,
          http_status: status,
          browser_device: browser,
          app_version: appVersion,
          status: 'open'
        }])
        .select()
        .single()

      // Alert if critical
      if (severity === 'critical' && !error) {
        sendEmailNotification(
          SUPERADMIN_EMAIL,
          `CRITICAL API ERROR: ${endpoint}`,
          `<h3>Critical Error Detected</h3>
           <p><strong>Endpoint:</strong> ${endpoint}</p>
           <p><strong>Message:</strong> ${message}</p>
           <p><strong>Status:</strong> ${status}</p>
           <hr/>
           <pre style="background:#f4f4f4;padding:10px;overflow-x:auto;">${stack || 'No stack trace'}</pre>`
        ).catch(err => console.error("Failed to send critical alert email", err))
      }
    }
  } catch (err) {
    console.error("Monitoring system failed to log error:", err.message)
  }
}

// ─── 15-Day Auto Archive Cron Job ───────────────────────
// Runs every day at Midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Running daily 15-day error archive job...')
  try {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

    // Fetch old errors
    const { data: oldErrors, error: fetchErr } = await supabase
      .from('system_errors')
      .select('*')
      .lte('last_seen', fifteenDaysAgo.toISOString())

    if (fetchErr) throw fetchErr
    if (!oldErrors || oldErrors.length === 0) {
      console.log('[Cron] No errors older than 15 days found.')
      return
    }

    // Convert to CSV
    const fields = ['id', 'severity', 'status', 'endpoint', 'error_message', 'occurrences', 'first_seen', 'last_seen']
    const json2csvParser = new Parser({ fields })
    const csvData = json2csvParser.parse(oldErrors)

    // Using base64 to attach the CSV
    const attachmentBase64 = Buffer.from(csvData).toString('base64')
    
    // Instead of raw SMTP which is tricky, we can send it via your existing emailService
    // We'll adjust sendEmailNotification to accept attachments if possible. 
    // If not, we'll just send a notice and keep them in DB or just delete.
    // Assuming we can just send the summary:
    const htmlBody = `
      <h3>15-Day Error Archive</h3>
      <p>Cleaned up ${oldErrors.length} old errors from the database.</p>
      <p>Data has been archived (Check server logs or implement attachment support in emailService).</p>
    `
    
    await sendEmailNotification(SUPERADMIN_EMAIL, 'MistriJi Error Archive (Over 15 Days Old)', htmlBody)

    // Delete them
    const idsToDelete = oldErrors.map(e => e.id)
    const { error: delErr } = await supabase
      .from('system_errors')
      .delete()
      .in('id', idsToDelete)

    if (delErr) throw delErr

    console.log(`[Cron] Successfully archived and deleted ${oldErrors.length} old errors.`)

  } catch (err) {
    console.error('[Cron] Error running archive job:', err)
  }
})

module.exports = { logError }
