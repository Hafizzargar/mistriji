/**
 * ─── App Config (Admin) ─────────────────────────────────────
 * Single source of truth for all environment-based config.
 */

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:3002`
  }
  return 'http://localhost:3002'
}

export const API_BASE_URL = getApiBaseUrl()
