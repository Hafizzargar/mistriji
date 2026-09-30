/**
 * ─── OTP Service ────────────────────────────────────────────
 * Handles all OTP-related API calls to the MistriJi Auth API.
 *
 * Endpoints used:
 *   POST /api/otp/send    - Send OTP via email or SMS
 *   POST /api/otp/verify  - Verify submitted OTP code
 *   GET  /api/health      - Health check
 */

import { API_BASE_URL } from '@/lib/config'

export interface OtpSendResult {
  success: boolean
  message?: string
  error?: string
  expiresIn?: number
}

export interface OtpVerifyResult {
  success: boolean
  verified?: boolean
  error?: string
}

/**
 * Send OTP to an email or phone number.
 * @param identifier - Email address or 10-digit phone number
 * @param type       - 'email' | 'phone'
 */
export async function sendOTP(
  identifier: string,
  type: 'email' | 'phone'
): Promise<OtpSendResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Failed to send OTP.' }
    return { success: true, message: data.message, expiresIn: data.expiresIn }
  } catch {
    return { success: false, error: 'Auth server unreachable. Please try again later.' }
  }
}

/**
 * Verify a 6-digit OTP code.
 * @param identifier - Email address or 10-digit phone number
 * @param code       - 6-digit OTP entered by user
 * @param type       - 'email' | 'phone'
 */
export async function verifyOTP(
  identifier: string,
  code: string,
  type: 'email' | 'phone'
): Promise<OtpVerifyResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, type }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Verification failed.' }
    return { success: true, verified: data.verified }
  } catch {
    return { success: false, error: 'Auth server unreachable. Please try again later.' }
  }
}

/**
 * Check if the Auth API backend is reachable.
 */
export async function checkAuthHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`)
    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
