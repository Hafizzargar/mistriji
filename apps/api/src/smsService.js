/**
 * ─── SMS Service (Fast2SMS Smart OTP) ─────────────────────
 * Uses Fast2SMS Smart OTP API for sending and verifying OTPs.
 * Docs: https://docs.fast2sms.com/reference/send-otp
 *
 * Endpoints:
 *   POST /dev/otp/send    — Send OTP
 *   POST /dev/otp/verify  — Verify OTP
 *   POST /dev/otp/resend  — Resend OTP
 */

const https = require('https')

/**
 * Make a POST request to Fast2SMS API.
 */
function fast2smsRequest(path, body) {
  const apiKey = process.env.FAST2SMS_API_KEY

  if (!apiKey) {
    return Promise.resolve({ success: false, error: 'SMS service not configured. Contact admin.' })
  }

  const postData = JSON.stringify(body)

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.fast2sms.com',
      port: 443,
      path: `/dev/otp/${path}`,
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch (e) {
          console.error('Fast2SMS parse error:', e.message, data)
          resolve({ return: false, message: 'SMS service error.' })
        }
      })
    })

    req.on('error', (err) => {
      console.error('Fast2SMS request error:', err.message)
      resolve({ return: false, message: 'Could not reach SMS service.' })
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Send OTP via Fast2SMS Bulk V2 API.
 * @param {string} phone - 10-digit Indian mobile number
 * @param {string} otp - 6-digit OTP code to send
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendSmsOTP(phone, otp) {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'Invalid phone number.' }
  }

  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) {
    return { success: false, error: 'SMS service not configured. Contact admin.' }
  }

  return new Promise((resolve) => {
    const timeStr = new Date().toLocaleTimeString()
    console.log(`[${timeStr}] 🔑 [DEV] Local OTP for ${cleanPhone} | Code: [${otp}]`)

    const encodedMessage = encodeURIComponent(`Your MistriJi verification code is ${otp}. Valid for 5 mins.`)
    const options = {
      hostname: 'www.fast2sms.com',
      port: 443,
      path: `/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodedMessage}&numbers=${cleanPhone}`,
      method: 'GET',
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.return === true || result.status_code === 200) {
            const timeStr = new Date().toLocaleTimeString()
            console.log(`[${timeStr}] 📱 OTP SMS sent to ${cleanPhone} | Code: [${otp}]`)
            resolve({ success: true })
          } else {
            console.error('Fast2SMS send error:', result)
            resolve({ success: false, error: result.message || 'SMS delivery failed.' })
          }
        } catch (e) {
          resolve({ success: false, error: 'SMS service error.' })
        }
      })
    })

    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.end()
  })
}

/**
 * Send a general SMS Notification via Fast2SMS Bulk V2 API.
 * @param {string} phone - 10-digit Indian mobile number
 * @param {string} message - The notification message
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendSmsNotification(phone, message) {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'Invalid phone number.' }
  }

  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) {
    return { success: false, error: 'SMS service not configured.' }
  }

  return new Promise((resolve) => {
    const encodedMessage = encodeURIComponent(message)
    const options = {
      hostname: 'www.fast2sms.com',
      port: 443,
      path: `/dev/bulkV2?route=q&message=${encodedMessage}&numbers=${cleanPhone}`,
      method: 'GET',
      headers: {
        'authorization': apiKey
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.return === true) {
            console.log(`📩 Notification SMS sent to ${cleanPhone}`)
            resolve({ success: true })
          } else {
            console.error('Fast2SMS bulk error:', result)
            resolve({ success: false, error: result.message || 'Failed to send SMS.' })
          }
        } catch (e) {
          resolve({ success: false, error: 'SMS service response error.' })
        }
      })
    })

    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.end()
  })
}

module.exports = { sendSmsOTP, sendSmsNotification }
