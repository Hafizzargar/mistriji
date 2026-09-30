/**
 * ─── API Layer — Barrel Export ────────────────────────────────────────────────
 *
 * Single import path for everything in the API layer.
 *
 * ✅ Usage:
 *   import { apiGet, apiPost }                   from '@/api'   // fetch helper
 *   import { ENDPOINTS }                          from '@/api'   // endpoint paths
 *   import { sendOTP, verifyOTP }                 from '@/api'   // OTP
 *   import { notifyAdmin, getAdminUrl }           from '@/api'   // notifications
 *   import { createPaymentOrder, verifyPayment }  from '@/api'   // payments
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Fetch helper (use this in new service files — never raw fetch) ────────────
export type { ApiResponse, RequestOptions }   from './apiClient'
export { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './apiClient'

// ── Endpoints (all API paths in one place) ────────────────────────────────────
export { ENDPOINTS } from './endpoints'

// ── Auth — OTP ───────────────────────────────────────────────────────────────
export type { OtpSendResult, OtpVerifyResult } from './services/auth/otpService'
export { sendOTP, verifyOTP, checkAuthHealth }  from './services/auth/otpService'

// ── Notifications ─────────────────────────────────────────────────────────────
export type { NotifyAdminParams }     from './services/notifications/notificationService'
export { notifyAdmin, getAdminUrl }   from './services/notifications/notificationService'

// ── Payments ──────────────────────────────────────────────────────────────────
export type {
  CreateOrderParams,
  CreateOrderResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  RazorpayCheckoutOptions,
} from './services/payments/paymentService'
export { createPaymentOrder, verifyPayment, openRazorpayCheckout } from './services/payments/paymentService'
