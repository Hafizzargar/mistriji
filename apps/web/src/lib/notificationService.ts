/**
 * ─── Notification Service ────────────────────────────────────
 * Handles sending notifications to the admin via backend API.
 *
 * Endpoints used:
 *   POST /api/notify/admin - Send email/push notification to admin
 */

import { API_BASE_URL } from '@/lib/config'

export interface NotifyAdminParams {
  message: string
  link?: string
}

/**
 * Send a notification to the Admin.
 * Fire-and-forget — errors are silently swallowed so they
 * never block the customer-facing flow.
 *
 * @param params.message - Notification message text
 * @param params.link    - Optional deep-link URL for the admin panel
 */
export function notifyAdmin(params: NotifyAdminParams): void {
  fetch(`${API_BASE_URL}/api/notify/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {
    // Intentionally silent — admin notifications are non-critical
  })
}

/**
 * Build the Admin Panel URL for a specific section.
 * Works for both localhost and mobile/LAN access.
 *
 * @param path - e.g. '/jobs', '/customers'
 */
export function getAdminUrl(path = '/'): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return `http://${host}:5173${path}`
}
