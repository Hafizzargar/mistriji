/**
 * ─── Auth API (Legacy Re-exports) ────────────────────────────────────────────
 * This file exists for backwards compatibility only.
 *
 * For new code, import from the proper service layer:
 *   import { sendOTP, verifyOTP }  from '@/api'
 *   import { API_BASE_URL }        from '@/lib/config'
 *   import { ENDPOINTS }           from '@/api/endpoints'
 * ─────────────────────────────────────────────────────────────────────────────
 */

export { getApiBaseUrl, API_BASE_URL, API_BASE_URL as AUTH_API_BASE } from '@/lib/config'
export { sendOTP, verifyOTP, checkAuthHealth } from '@/api/services/auth/otpService'
