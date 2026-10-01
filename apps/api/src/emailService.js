/**
 * ─── Email Service (Nodemailer) ───────────────────────────
 * Sends OTP codes via Gmail SMTP using Nodemailer.
 */

const nodemailer = require('nodemailer')

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  const email = process.env.SMTP_EMAIL
  const password = process.env.SMTP_PASSWORD

  if (!email || !password) {
    console.error('❌ SMTP_EMAIL and SMTP_PASSWORD are required in .env')
    return null
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: email,
      pass: password,
    },
  })

  return transporter
}

/**
 * Send an OTP email to the given address.
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmailOTP(toEmail, otp) {
  const transport = getTransporter()
  if (!transport) {
    return { success: false, error: 'Email service not configured. Contact admin.' }
  }

  const mailOptions = {
    from: `"MistriJi" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `${otp} — Your MistriJi Login Code`,
    html: `
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
          If you didn't request this, please ignore this email.
        </div>
        
        <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px;">
          © ${new Date().getFullYear()} MistriJi — Jammu & Kashmir
        </p>
      </div>
    `,
  }

  try {
    await transport.sendMail(mailOptions)
    console.log(`📧 OTP email sent to ${toEmail} | Code: [${otp}]`)
    return { success: true }
  } catch (err) {
    console.error('Email send error:', err.message)
    return { success: false, error: 'SMTP Error: ' + err.message }
  }
}

/**
 * Send an onboarding / welcome email to newly created administrators.
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email address
 * @param {string} params.name - Administrator's full name
 * @param {string} params.pin - 6-digit access PIN
 * @param {string} [params.phone] - Mobile number (optional)
 * @param {string} [params.role] - Admin role name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendAdminWelcomeEmail({ toEmail, name, pin, phone, role = 'Administrator' }) {
  const transport = getTransporter()
  if (!transport) {
    return { success: false, error: 'Email service not configured.' }
  }

  const portalUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:3001'

  const mailOptions = {
    from: `"MistriJi Admin Portal" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `🎉 Welcome to MistriJi — Administrator Account & Login Credentials`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
          <div style="font-size: 38px; margin-bottom: 8px;">🔧</div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">MistriJi Admin Console</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #c7d2fe; font-weight: 500;">Staff Onboarding & Security Provisioning</p>
        </div>

        <div style="padding: 28px 24px;">
          <!-- Welcome Message -->
          <p style="font-size: 16px; color: #1e293b; margin: 0 0 16px; line-height: 1.6;">
            Hello <strong>${name || 'Administrator'}</strong>,
          </p>
          <p style="font-size: 14px; color: #475569; margin: 0 0 20px; line-height: 1.6;">
            You have been registered as an authorized <strong>${role}</strong> on the MistriJi Platform. Your administrative credentials and access instructions are detailed below:
          </p>

          <!-- Credentials Card -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">
              🔐 Your Administrative Login Credentials
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 500;">Admin Portal:</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: 600;">
                  <a href="${portalUrl}" style="color: #4f46e5; text-decoration: none;">${portalUrl}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Login Email:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${toEmail}</td>
              </tr>
              ${phone ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Mobile Number:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">+91 ${phone}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Assigned Role:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${role}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0 6px; color: #64748b; font-weight: 500;">6-Digit Access PIN:</td>
                <td style="padding: 10px 0 6px;">
                  <span style="background: #1e1b4b; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-family: monospace; font-size: 16px; font-weight: 800; letter-spacing: 3px;">
                    ${pin}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Step-by-Step Instructions -->
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 10px;">
              🚀 How to Log In (2-Factor Authentication):
            </h3>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.8;">
              <li>Navigate to the <a href="${portalUrl}" style="color: #4f46e5; font-weight: 600;">Admin Console</a>.</li>
              <li>Select <strong>Email OTP</strong> and enter your email address (<code>${toEmail}</code>).</li>
              <li>Enter the 6-digit one-time code sent to your email.</li>
              <li>Enter your <strong>6-digit Access PIN</strong> (<code>${pin}</code>) to access the dashboard.</li>
              <li><em>Recommended:</em> Update your PIN upon your first login under <strong>Settings &rarr; Security & PIN</strong>.</li>
            </ol>
          </div>

          <!-- Terms, Conditions & Policy -->
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 12px; color: #78350f; line-height: 1.6;">
            <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: #92400e;">
              📋 Administrative Terms, Conditions & Code of Conduct:
            </div>
            <ul style="margin: 0; padding-left: 18px;">
              <li><strong>Confidentiality:</strong> Customer phone numbers, addresses, and worker KYC documents are strictly confidential. Sharing or exporting client data is forbidden.</li>
              <li><strong>Verification Integrity:</strong> Only approve worker documents, certifications, and service disputes in accordance with standard MistriJi vetting guidelines.</li>
              <li><strong>Audit Logging:</strong> All operational actions, status adjustments, and job assignments are logged with timestamps and operator IDs.</li>
              <li><strong>Security:</strong> Never disclose your Access PIN or OTP codes to third parties.</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 28px 0 10px;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
              Access MistriJi Admin Console &rarr;
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0 0 4px;">MistriJi Platform &bull; Jammu & Kashmir, India</p>
          <p style="margin: 0;">This is an automated system email. If you did not expect this invitation, please contact the Super Administrator immediately.</p>
        </div>

      </div>
    `,
  }

  try {
    await transport.sendMail(mailOptions)
    console.log(`📧 Admin Welcome & Credentials email sent to ${toEmail}`)
    return { success: true }
  } catch (err) {
    console.error('Admin welcome email send error:', err.message)
    return { success: false, error: 'Failed to send welcome email: ' + err.message }
  }
}

async function sendEmailNotification(toEmail, subject, messageHtml) {
  const transport = getTransporter()
  if (!transport) return { success: false }
  
  try {
    await transport.sendMail({
      from: `"MistriJi Admin" <${process.env.SMTP_EMAIL}>`,
      to: toEmail,
      subject,
      html: messageHtml
    })
    console.log(`📧 Notification email sent to ${toEmail}`)
    return { success: true }
  } catch (err) {
    console.error('Email notify error:', err.message)
    return { success: false }
  }
}

module.exports = { sendEmailOTP, sendEmailNotification, sendAdminWelcomeEmail }
