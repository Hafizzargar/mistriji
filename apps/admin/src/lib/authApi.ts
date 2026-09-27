/**
 * ─── Auth API Client ──────────────────────────────────────
 * Frontend client for communicating with the MistriJi Auth API
 * running on port 3002.
 */

export const AUTH_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

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
      headers: {
        'Content-Type': 'application/json',
        'x-admin-portal': 'true',
      },
      body: JSON.stringify({ identifier, type, role: 'admin' }),
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
      headers: {
        'Content-Type': 'application/json',
        'x-admin-portal': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({ identifier, code, type, role: 'admin' }),
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
 * Verify PIN for Admin login and obtain JWT
 */
export async function verifyPin(
  identifier: string,
  code: string,
  pin: string,
  type: 'email' | 'phone'
): Promise<{ success: boolean; session?: any; error?: string }> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/otp/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-portal': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({ identifier, code, pin, type, role: 'admin' }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Verification failed.' }
    }

    return { success: true, session: data.session }
  } catch (err: any) {
    console.error('PIN verify error:', err)
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

/**
 * Update/Reset PIN using OTP verification.
 */
export async function updatePinWithOTP(
  identifier: string,
  code: string,
  newPin: string,
  type: 'email' | 'phone'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/otp/update-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-portal': 'true',
      },
      body: JSON.stringify({ identifier, code, newPin, type }),
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update PIN.' }
    }

    return { success: true, message: data.message }
  } catch (err: any) {
    console.error('Update PIN error:', err)
    return { success: false, error: 'Auth server unreachable. Please try again later.' }
  }
}

/**
 * Send welcome & credentials email to a newly created admin.
 */
export async function sendAdminWelcomeEmailApi(params: {
  email: string
  name: string
  pin: string
  phone?: string
  role?: string
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/admin/send-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-portal': 'true',
      },
      body: JSON.stringify(params),
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to send welcome email.' }
    }

    return { success: true, message: data.message }
  } catch (err: any) {
    console.error('Send welcome email error:', err)
    return { success: false, error: 'Auth server unreachable.' }
  }
}
