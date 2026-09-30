/**
 * ─── Payment Service ─────────────────────────────────────────
 * Handles all Razorpay payment-related API calls.
 *
 * Endpoints used:
 *   POST /api/payments/create-order - Create a Razorpay order
 *   POST /api/payments/verify       - Verify a completed payment
 */

import { API_BASE_URL, RAZORPAY_KEY_ID } from '@/lib/config'

export interface CreateOrderParams {
  amount: number    // Amount in PAISE (₹1 = 100 paise)
  currency?: string // Default: 'INR'
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

/**
 * Create a Razorpay order on the backend.
 */
export async function createPaymentOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency || 'INR',
        userId: params.userId,
        jobId: params.jobId,
      }),
    })
    const data = await res.json()
    if (!data.success) return { success: false, error: data.error || 'Failed to create order.' }
    return { success: true, order_id: data.order_id, amount: data.amount, currency: data.currency }
  } catch {
    return { success: false, error: 'Payment server unreachable. Please try again.' }
  }
}

/**
 * Verify a Razorpay payment signature on the backend.
 */
export async function verifyPayment(
  params: VerifyPaymentParams
): Promise<VerifyPaymentResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await res.json()
    if (!data.success) return { success: false, error: data.error || 'Payment verification failed.' }
    return { success: true }
  } catch {
    return { success: false, error: 'Payment verification failed. Please contact support.' }
  }
}

/**
 * Open the Razorpay checkout modal.
 * Requires the Razorpay script to be loaded in index.html.
 */
export function openRazorpayCheckout(options: {
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
  onSuccess: (response: any) => void
  onFailure: (description: string) => void
}): void {
  const rzpOptions = {
    key: RAZORPAY_KEY_ID,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.order_id,
    handler: options.onSuccess,
    prefill: options.prefill,
    theme: { color: '#4f46e5' },
  }

  // @ts-ignore — Razorpay loaded via CDN script tag in index.html
  const rzp = new window.Razorpay(rzpOptions)
  rzp.on('payment.failed', (response: any) => {
    options.onFailure(response.error.description)
  })
  rzp.open()
}
