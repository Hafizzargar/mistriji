/**
 * ─── App Config ─────────────────────────────────────────────
 * Single source of truth for all environment-based config.
 * Import from here — never hardcode URLs in components.
 */

/**
 * Returns the backend API base URL.
 * Priority:
 *   1. VITE_API_URL env variable (set in production / Vercel)
 *   2. Auto-resolved from window.location.hostname (local dev over Wi-Fi)
 *   3. Fallback: localhost:3002
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // If running inside Capacitor mobile app or production, use production Render backend
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
     window.location.protocol === 'file:' ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     (window as any).Capacitor !== undefined)
  ) {
    return 'https://mistriji.onrender.com'
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:3002`
  }
  return 'https://mistriji.onrender.com'
}

/** Pre-resolved API base URL (use this in service files) */
export const API_BASE_URL = getApiBaseUrl()

/** Razorpay Key ID */
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''
