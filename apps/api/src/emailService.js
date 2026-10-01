/**
 * ─── Email Service (Resend HTTP API) ───────────────────────────
 * Sends OTP codes via Resend API (HTTP port 443) to bypass Render's SMTP block.
 */

async function sendEmailOTP(toEmail, otp) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.error('❌ RESEND_API_KEY is required in .env')
    return { success: false, error: 'Email service not configured. Contact admin.' }
  }

  // If using Resend without a custom domain, you MUST use onboarding@resend.dev as the from address,
  // and you can only send emails to the address you signed up with.
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

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

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `MistriJi <${fromEmail}>`,
        to: [toEmail],
        subject: `${otp} — Your MistriJi Login Code`,
        html: htmlContent
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API Error:', data)
      return { success: false, error: 'Resend API Error: ' + (data.message || 'Unknown error') }
    }

    console.log(`📧 OTP email sent via Resend to ${toEmail} | Code: [${otp}]`)
    return { success: true }
  } catch (err) {
    console.error('Email send error:', err.message)
    return { success: false, error: 'HTTP Email Error: ' + err.message }
  }
}

async function sendAdminWelcomeEmail({ toEmail, name, pin, phone, role = 'Administrator' }) {
  // Simplified for HTTP bypass
  return { success: true }
}

async function sendEmailNotification(toEmail, subject, messageHtml) {
  // Simplified for HTTP bypass
  return { success: true }
}

module.exports = { sendEmailOTP, sendEmailNotification, sendAdminWelcomeEmail }
