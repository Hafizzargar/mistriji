/**
 * ─── API Client (Fetch Helper) ───────────────────────────────────────────────
 * A single, typed fetch wrapper used by ALL service files.
 *
 * Benefits:
 *  - Base URL injected automatically from config
 *  - Default headers set once (Content-Type, optional auth token)
 *  - Unified error shape: every call returns { data, error }
 *  - No component ever builds a raw fetch request
 *
 * ✅ Usage in service files:
 *   import { apiGet, apiPost } from '@/api/apiClient'
 *
 *   const { data, error } = await apiPost(ENDPOINTS.OTP.SEND, { identifier, type })
 *   const { data, error } = await apiGet(ENDPOINTS.HEALTH)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { API_BASE_URL } from '@/lib/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  status: number
}

export type RequestOptions = {
  /** Extra headers merged with defaults */
  headers?: Record<string, string>
  /** Auth token — sent as Bearer if provided */
  token?: string
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    // Try to parse JSON; fall back to null if empty response
    let data: T | null = null
    const contentType = res.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      data = await res.json()
    }

    if (!res.ok) {
      const errMsg = (data as any)?.error || `Request failed with status ${res.status}`
      return { data: null, error: errMsg, status: res.status }
    }

    return { data, error: null, status: res.status }
  } catch (err: any) {
    return {
      data:   null,
      error:  err?.message || 'Network error — server unreachable.',
      status: 0,
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** GET request */
export function apiGet<T = unknown>(
  endpoint: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('GET', endpoint, undefined, options)
}

/** POST request */
export function apiPost<T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('POST', endpoint, body, options)
}

/** PUT request */
export function apiPut<T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('PUT', endpoint, body, options)
}

/** PATCH request */
export function apiPatch<T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', endpoint, body, options)
}

/** DELETE request */
export function apiDelete<T = unknown>(
  endpoint: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('DELETE', endpoint, undefined, options)
}
