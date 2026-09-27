/**
 * ─── Auth API Client ──────────────────────────────────────
 * Frontend client for communicating with the MistriJi Auth API
 * running on port 3002.
 */

const AUTH_API_BASE = 'http://localhost:3002'

/**
 * Send OTP to an email or phone number.
 * @param identifier - Email address or 10-digit phone number
 * @param type - 'email' or 'phone'
 */
export async function sendOTP(
  identifier: string,
  type: 'email' | 'phone'
): Promise<{ success: boolean; message?: string; error?: string; expiresIn?: number }> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to send OTP.' }
    }

    return { success: true, message: data.message, expiresIn: data.expiresIn }
  } catch (err: any) {
    console.error('OTP send error:', err)
    return { success: false, error: 'Auth server unreachable. Please try again later.' }
  }
}

/**
 * Verify an OTP code for a given email or phone.
 * @param identifier - Email address or 10-digit phone number
 * @param code - 6-digit OTP code
 * @param type - 'email' or 'phone'
 */
export async function verifyOTP(
  identifier: string,
  code: string,
  type: 'email' | 'phone'
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, type }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Verification failed.' }
    }

    return { success: true, verified: data.verified }
  } catch (err: any) {
    console.error('OTP verify error:', err)
    return { success: false, error: 'Auth server unreachable. Please try again later.' }
  }
}

/**
 * Check health of Auth API.
 */
export async function checkAuthHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/health`)
    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
