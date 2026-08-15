import axios, { CanceledError } from 'axios'

/**
 * Platform console API client — never imported by the tenant SPA, and it never
 * imports the tenant client. The two authentication planes are deliberately
 * separate code paths with separate storage, so neither can leak a token into
 * the other or clobber the other's session in a shared browser profile.
 */
const api = axios.create({
  baseURL: '/api/platform',
  headers: { 'Content-Type': 'application/json' },
})

// Deliberately distinct from the tenant keys (`token` / `refresh_token` /
// `user`) so a platform and a tenant session can coexist.
const PLATFORM_TOKEN_KEY = 'assetvault_platform_token'
const PLATFORM_REFRESH_TOKEN_KEY = 'assetvault_platform_refresh_token'
const PLATFORM_ADMIN_KEY = 'assetvault_platform_admin'

const LOGIN_PATH = '/login'

// Shared by every 401 so parallel queries trigger a single refresh.
let refreshPromise: Promise<string | null> | null = null
// Latched once the session is unrecoverable, so queued requests fail fast
// instead of each one re-attempting a refresh and re-triggering a redirect.
let sessionEnded = false

export function getPlatformAccessToken(): string | null {
  return localStorage.getItem(PLATFORM_TOKEN_KEY)
}

export function getPlatformRefreshToken(): string | null {
  return localStorage.getItem(PLATFORM_REFRESH_TOKEN_KEY)
}

export function getStoredPlatformAdmin(): PlatformAdmin | null {
  try {
    const raw = localStorage.getItem(PLATFORM_ADMIN_KEY)
    return raw ? (JSON.parse(raw) as PlatformAdmin) : null
  } catch {
    return null
  }
}

export function storePlatformSession(
  accessToken: string,
  refreshToken: string,
  admin: PlatformAdmin,
) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken)
  localStorage.setItem(PLATFORM_REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin))
}

export function clearStoredPlatformAuth() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY)
  localStorage.removeItem(PLATFORM_REFRESH_TOKEN_KEY)
  localStorage.removeItem(PLATFORM_ADMIN_KEY)
}

let onSessionEnded: (() => void) | null = null

export function setPlatformSessionEndedHandler(handler: () => void) {
  onSessionEnded = handler
}

function endSession() {
  clearStoredPlatformAuth()
  if (sessionEnded) return
  sessionEnded = true
  onSessionEnded?.()
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH)
  }
}

// A token the backend can never accept is worth dropping before the first
// render fans out queries. Structure only — the backend verifies signatures.
function isStructurallyValidJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

const storedPlatformToken = getPlatformAccessToken()
if (storedPlatformToken !== null && !isStructurallyValidJwt(storedPlatformToken)) {
  clearStoredPlatformAuth()
}

async function refreshPlatformAccessToken(): Promise<string | null> {
  const refreshToken = getPlatformRefreshToken()
  if (!refreshToken || !isStructurallyValidJwt(refreshToken)) {
    return null
  }
  try {
    // Bare axios: going through `api` would recurse into this interceptor.
    const { data } = await axios.post<PlatformTokenResponse>(
      '/api/platform/auth/refresh',
      { refresh_token: refreshToken },
    )
    localStorage.setItem(PLATFORM_TOKEN_KEY, data.access_token)
    localStorage.setItem(PLATFORM_REFRESH_TOKEN_KEY, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

api.interceptors.request.use(
  (config) => {
    if (sessionEnded) {
      return Promise.reject(new CanceledError('Platform session ended'))
    }
    const token = getPlatformAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// One refresh attempt per 401, then end the session exactly once.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // Relative to baseURL `/api/platform`. A 401 from these means the
    // credentials themselves are bad; refreshing cannot help and would recurse.
    const url = String(original?.url || '')
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint ||
      sessionEnded
    ) {
      return Promise.reject(error)
    }

    original._retry = true
    if (!refreshPromise) {
      refreshPromise = refreshPlatformAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (!newToken) {
      endSession()
      return Promise.reject(error)
    }
    original.headers = original.headers || {}
    original.headers.Authorization = `Bearer ${newToken}`
    return api(original)
  },
)

export interface PlatformAdmin {
  id: string
  email: string
  full_name: string
  is_active: boolean
  last_login?: string | null
}

export interface PlatformTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  admin_id: string
  full_name: string
  email: string
}

export type OrganizationStatus =
  | 'pending_review'
  | 'rejected'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'deleted'

export type OrganizationPlan = 'starter' | 'business' | 'enterprise'

export const ORGANIZATION_STATUSES: OrganizationStatus[] = [
  'pending_review',
  'trialing',
  'active',
  'past_due',
  'suspended',
  'rejected',
  'deleted',
]

export const ORGANIZATION_PLANS: { value: OrganizationPlan; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
]

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  status: OrganizationStatus | string
  plan: OrganizationPlan | string
  contact_email?: string | null
  country?: string | null
  institution_type?: string | null
  created_at: string
  trial_ends_at?: string | null
}

export interface OrganizationDetail extends OrganizationSummary {
  grace_ends_at?: string | null
  updated_at: string
  deleted_at?: string | null
  contact_phone?: string | null
  website?: string | null
  use_case?: string | null
  signup_ip?: string | null
  signup_user_agent?: string | null
  rejection_reason?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  notes?: string | null
}

export interface OrganizationListResponse {
  items: OrganizationSummary[]
  total: number
  page: number
  pages: number
}

export interface ActivateResponse {
  organization: OrganizationDetail
  invite_token: string | null
  admin_email: string
  admin_user_id: string
}

export interface OrganizationStats {
  total: number
  by_status: Record<string, number>
  pending_review: number
  trials_expiring_soon: OrganizationSummary[]
}

export interface PlatformAuditEntry {
  id: number
  actor_email: string
  action: string
  target_organization_id?: string | null
  target_type?: string | null
  target_id?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  reason?: string | null
  ip_address?: string | null
  occurred_at: string
}

export interface PlatformAuditListResponse {
  items: PlatformAuditEntry[]
  total: number
  page: number
  pages: number
}

export function apiErrorDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export async function platformLogin(email: string, password: string) {
  const { data } = await api.post<PlatformTokenResponse>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function platformLogout(refreshToken: string | null) {
  await api.post('/auth/logout', { refresh_token: refreshToken })
}

export async function platformMe() {
  const { data } = await api.get<PlatformAdmin>('/auth/me')
  return data
}

export async function listOrganizations(params?: {
  status?: string
  page?: number
  size?: number
  q?: string
}) {
  const { data } = await api.get<OrganizationListResponse>('/organizations', {
    params,
  })
  return data
}

export async function getOrganization(id: string) {
  const { data } = await api.get<OrganizationDetail>(`/organizations/${id}`)
  return data
}

export async function createOrganization(body: {
  name: string
  slug?: string
  contact_email?: string
  plan?: string
  notes?: string
}) {
  const { data } = await api.post<OrganizationDetail>('/organizations', body)
  return data
}

export async function activateOrganization(
  id: string,
  body: {
    slug: string
    plan?: string
    admin_email?: string
    admin_full_name?: string
  },
) {
  const { data } = await api.post<ActivateResponse>(
    `/organizations/${id}/activate`,
    body,
  )
  return data
}

export async function rejectOrganization(id: string, reason: string) {
  const { data } = await api.post<OrganizationDetail>(
    `/organizations/${id}/reject`,
    { reason },
  )
  return data
}

export async function suspendOrganization(id: string, reason?: string) {
  const { data } = await api.post<OrganizationDetail>(
    `/organizations/${id}/suspend`,
    { reason },
  )
  return data
}

export async function reactivateOrganization(id: string) {
  const { data } = await api.post<OrganizationDetail>(
    `/organizations/${id}/reactivate`,
  )
  return data
}

export async function patchOrganization(
  id: string,
  body: {
    name?: string
    plan?: string
    notes?: string
    trial_ends_at?: string
  },
) {
  const { data } = await api.patch<OrganizationDetail>(
    `/organizations/${id}`,
    body,
  )
  return data
}

export async function getStats() {
  const { data } = await api.get<OrganizationStats>('/stats')
  return data
}

export async function listAudit(params?: { page?: number; size?: number }) {
  const { data } = await api.get<PlatformAuditListResponse>('/audit', { params })
  return data
}
