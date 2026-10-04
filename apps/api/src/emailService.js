/**
 * ─── Email Service (Brevo API) ───────────────────────────────
 * Sends OTP codes via Brevo HTTP API (port 443).
 * Works from Render, Vercel, anywhere — no domain required.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

async function sendEmailOTP(toEmail, otp) {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.error('❌ BREVO_API_KEY is required in .env')
    return { success: false, error: 'Email service not configured. Contact admin.' }
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL || 'hafezzargar987@gmail.com'
  const fromName  = process.env.BREVO_FROM_NAME  || 'MistriJi'

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 28px;">🔧 MistriJi</h1>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0;">Jammu's Trusted Worker Platform</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 20px;">
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0 0 8px;">Your verification code is</p>
        <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px 24px; display: inline-block;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #fff;">${otp}</span>
        </div>
        <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 12px 0 0;">Expires in 5 minutes</p>
      </div>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
        <strong style="color: #334155;">⚠️ Security Notice</strong><br/>
        Never share this code with anyone. MistriJi staff will never ask for your OTP.
      </div>
    </div>
  `

  const timeStr = new Date().toLocaleTimeString()
  console.log(`[${timeStr}] 🔑 [DEV] Local OTP for ${toEmail} | Code: [${otp}]`)

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject: `${otp} — Your MistriJi Login Code`,
        htmlContent
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Brevo API Error:', JSON.stringify(data))
      return { success: false, error: 'Brevo API Error: ' + (data.message || 'Unknown error') }
    }

    const timeStr = new Date().toLocaleTimeString()
    console.log(`[${timeStr}] 📧 OTP email sent via Brevo to ${toEmail} | Code: [${otp}]`)
    return { success: true }
  } catch (err) {
    console.error('Email send error:', err.message)
    return { success: false, error: 'Email Error: ' + err.message }
  }
}

async function sendEmailNotification(toEmail, subject, messageHtml) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { success: false, error: 'Email service not configured.' }

  const fromEmail = process.env.BREVO_FROM_EMAIL || 'hafezzargar987@gmail.com'
  const fromName  = process.env.BREVO_FROM_NAME  || 'MistriJi'

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent: messageHtml
      })
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Brevo notification error:', JSON.stringify(data))
      return { success: false, error: data.message }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function sendAdminWelcomeEmail({ toEmail, name, pin, phone, role = 'Administrator' }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { success: false, error: 'Email service not configured.' }

  const fromEmail = process.env.BREVO_FROM_EMAIL || 'hafezzargar987@gmail.com'
  const fromName  = process.env.BREVO_FROM_NAME  || 'MistriJi'

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #4f46e5;">🔧 Welcome to MistriJi, ${name}!</h1>
      <p>Your admin account has been created. Here are your login details:</p>
      <ul>
        <li><strong>Role:</strong> ${role}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>PIN:</strong> ${pin}</li>
      </ul>
      <p style="color: #ef4444;"><strong>Please keep your PIN secret and do not share it with anyone.</strong></p>
    </div>
  `

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject: 'Welcome to MistriJi Admin',
        htmlContent
      })
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Brevo welcome email error:', JSON.stringify(data))
      return { success: false, error: data.message }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = { sendEmailOTP, sendEmailNotification, sendAdminWelcomeEmail }
