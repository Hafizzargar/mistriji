/**
 * ─── Payment Service ─────────────────────────────────────────────────────────
 * All Razorpay payment-related API calls.
 *
 * Endpoints: ENDPOINTS.PAYMENTS.*
 * Client:    apiPost from @/api/apiClient
 * Config:    RAZORPAY_KEY_ID from @/lib/config
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { apiPost } from '@/api/apiClient'
import { ENDPOINTS } from '@/api/endpoints'
import { RAZORPAY_KEY_ID } from '@/lib/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateOrderParams {
  amount: number      // In PAISE (₹1 = 100 paise)
  currency?: string   // Default: 'INR'
  userId: string
  jobId: string
}

export interface CreateOrderResult {
  success: boolean
  order_id?: string
  amount?: number
  currency?: string
  error?: string
}

export interface VerifyPaymentParams {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  userEmail?: string | null
  userName?: string | null
}

export interface VerifyPaymentResult {
  success: boolean
  error?: string
}

export interface RazorpayCheckoutOptions {
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
  onSuccess: (response: any) => void
  onFailure: (description: string) => void
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Create a Razorpay order via the backend.
 * Must be called before opening the Razorpay checkout modal.
 */
export async function createPaymentOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const { data, error } = await apiPost<any>(ENDPOINTS.PAYMENTS.CREATE_ORDER, {
    amount:   params.amount,
    currency: params.currency || 'INR',
    userId:   params.userId,
    jobId:    params.jobId,
  })
  if (error) return { success: false, error }
  return { success: true, order_id: data?.order_id, amount: data?.amount, currency: data?.currency }
}

/**
 * Verify a Razorpay payment signature on the backend after checkout completes.
 */
export async function verifyPayment(
  params: VerifyPaymentParams
): Promise<VerifyPaymentResult> {
  const { error } = await apiPost(ENDPOINTS.PAYMENTS.VERIFY, params)
  if (error) return { success: false, error }
  return { success: true }
}

/**
 * Open the Razorpay checkout modal.
 * Requires: <script src="https://checkout.razorpay.com/v1/checkout.js"></script> in index.html
 */
export function openRazorpayCheckout(options: RazorpayCheckoutOptions): void {
  // @ts-ignore — Razorpay is loaded via CDN, not an npm package
  const rzp = new window.Razorpay({
    key:         RAZORPAY_KEY_ID,
    amount:      options.amount,
    currency:    options.currency,
    name:        options.name,
    description: options.description,
    order_id:    options.order_id,
    handler:     options.onSuccess,
    prefill:     options.prefill,
    theme:       { color: '#4f46e5' },
  })
  rzp.on('payment.failed', (response: any) => {
    options.onFailure(response.error.description)
  })
  rzp.open()
}
