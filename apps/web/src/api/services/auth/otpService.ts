/**
 * ─── OTP Service ─────────────────────────────────────────────────────────────
 * All OTP-related API calls.
 *
 * Endpoints: ENDPOINTS.OTP.*
 * Client:    apiPost, apiGet from @/api/apiClient
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { apiPost, apiGet } from '@/api/apiClient'
import { ENDPOINTS } from '@/api/endpoints'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Send an OTP to an email address or phone number.
 *
 * @param identifier - Email address or 10-digit phone number
 * @param type       - 'email' | 'phone'
 */
export async function sendOTP(
  identifier: string,
  type: 'email' | 'phone'
): Promise<OtpSendResult> {
  const { data, error } = await apiPost<any>(ENDPOINTS.OTP.SEND, { identifier, type })
  if (error) return { success: false, error }
  return { success: true, message: data?.message, expiresIn: data?.expiresIn }
}

/**
 * Verify a 6-digit OTP submitted by the user.
 *
 * @param identifier - Email address or 10-digit phone number
 * @param code       - 6-digit OTP
 * @param type       - 'email' | 'phone'
 */
export async function verifyOTP(
  identifier: string,
  code: string,
  type: 'email' | 'phone'
): Promise<OtpVerifyResult> {
  const { data, error } = await apiPost<any>(ENDPOINTS.OTP.VERIFY, { identifier, code, type })
  if (error) return { success: false, error }
  return { success: true, verified: data?.verified }
}

/**
 * Check if the Auth API backend is reachable.
 */
export async function checkAuthHealth(): Promise<boolean> {
  const { data, error } = await apiGet<{ status: string }>(ENDPOINTS.HEALTH)
  return !error && data?.status === 'ok'
}
