/**
 * ─── Notification Service ─────────────────────────────────────────────────────
 * Send notifications to admin via backend API.
 *
 * Endpoints: ENDPOINTS.NOTIFY.*
 * Client:    apiPost from @/api/apiClient
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { apiPost } from '@/api/apiClient'
import { ENDPOINTS } from '@/api/endpoints'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotifyAdminParams {
  message: string
  link?: string
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: notify the Admin about an event.
 * Errors are silently swallowed — admin notifications must never
 * block or crash the customer-facing flow.
 *
 * @param params.message - Notification message text
 * @param params.link    - Optional deep-link to admin panel page
 */
export function notifyAdmin(params: NotifyAdminParams): void {
  apiPost(ENDPOINTS.NOTIFY.ADMIN, params).catch(() => {
    // Intentionally silent — non-critical
  })
}

/**
 * Build an admin panel URL that works for both localhost and LAN (mobile).
 *
 * @param path - e.g. '/jobs', '/customers'
 */
export function getAdminUrl(path = '/'): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return `http://${host}:5173${path}`
}
