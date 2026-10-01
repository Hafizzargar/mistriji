/**
 * ─── App Config (Admin) ─────────────────────────────────────
 * Single source of truth for all environment-based config.
 */

export function getApiBaseUrl(): string {
  // 1. Try environment variable first
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  
  // 2. Fallback if running on Vercel (useful for preview deployments that miss the prod env var)
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://mistriji.onrender.com'
    }
    // 3. Local fallback
    return `http://${window.location.hostname}:3002`
  }
  return 'http://localhost:3002'
}

export const API_BASE_URL = getApiBaseUrl()
