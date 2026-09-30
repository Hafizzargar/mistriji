/**
 * ─── API Endpoints ────────────────────────────────────────────────────────────
 * Single source of truth for ALL backend API endpoint paths.
 *
 * Rules:
 *  - Static paths are plain strings.
 *  - Paths with dynamic segments (IDs) are arrow functions.
 *  - All paths are built from the API_PREFIX constant.
 *  - No trailing slashes (backend uses Express without strictSlash).
 *
 * ✅ Usage:
 *   import { ENDPOINTS } from '@/api/endpoints'
 *
 *   ENDPOINTS.OTP.SEND                 → '/api/otp/send'
 *   ENDPOINTS.OTP.VERIFY               → '/api/otp/verify'
 *   ENDPOINTS.NOTIFY.CUSTOMER(jobId)   → '/api/notify/customer-assigned'
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Version prefix. Bump to '/api/v2' here only when backend is upgraded. */
const V = '/api'

export const ENDPOINTS = {

  /** ── Health ─────────────────────────────────────────────── */
  HEALTH: `${V}/health`,

  /** ── OTP — phone & email verification ──────────────────── */
  OTP: {
    SEND:         `${V}/otp/send`,
    VERIFY:       `${V}/otp/verify`,
    VERIFY_PIN:   `${V}/otp/verify-pin`,
    UPDATE_PIN:   `${V}/otp/update-pin`,
    RESEND:       `${V}/otp/resend`,
    REFRESH:      `${V}/otp/refresh`,
    LOGOUT:       `${V}/otp/logout`,
    RESET_LIMITS: `${V}/otp/reset-limits`,
  },

  /** ── Admin — onboarding & account management ────────────── */
  ADMIN: {
    SEND_WELCOME: `${V}/admin/send-welcome`,
  },

  /** ── Payments — Razorpay integration ────────────────────── */
  PAYMENTS: {
    CREATE_ORDER: `${V}/payments/create-order`,
    VERIFY:       `${V}/payments/verify`,
  },

  /** ── Notifications ───────────────────────────────────────── */
  NOTIFY: {
    ADMIN:             `${V}/notify/admin`,
    CUSTOMER_ASSIGNED: `${V}/notify/customer-assigned`,
  },

  /** ── Error logging ───────────────────────────────────────── */
  ERRORS: {
    LOG: `${V}/errors/log`,
  },

} as const
