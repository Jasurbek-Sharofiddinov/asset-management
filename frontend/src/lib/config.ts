/**
 * Public site hostname — single source for landing/login labels and demo QR URLs.
 *
 * Set VITE_BASE_DOMAIN at build time (Docker Compose prod passes BASE_DOMAIN).
 * Default matches the destination apex.
 * Tenant app host: {VITE_APP_SUBDOMAIN}.{BASE_DOMAIN} (default app.*).
 * Platform console host is separate (PLATFORM_SUBDOMAIN / admin.*) — not used here.
 */
export const BASE_DOMAIN =
  (import.meta.env.VITE_BASE_DOMAIN as string | undefined)?.trim() || 'assetvault.uz'

export const APP_SUBDOMAIN =
  (import.meta.env.VITE_APP_SUBDOMAIN as string | undefined)?.trim() || 'app'

export const APP_HOST = `${APP_SUBDOMAIN}.${BASE_DOMAIN}`
export const APP_ORIGIN = `https://${APP_HOST}`
export const DEMO_HOST = `demo.${BASE_DOMAIN}`

/** Infra labels that are never a customer workspace slug. `demo` is bindable. */
const INFRA_LABELS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'static',
  'assets',
  'cdn',
  'staging',
  'dev',
  'status',
  'support',
  'help',
  'docs',
  'default',
  'console',
  'platform',
  'auth',
  'login',
  'signup',
  'billing',
  'webhook',
  'webhooks',
  'asset',
  APP_SUBDOMAIN,
])

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function hostnameOf(hostname: string): string {
  return hostname.split(':')[0].toLowerCase()
}

export function isLocalHost(hostname: string = window.location.hostname): boolean {
  const host = hostnameOf(hostname)
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function isSharedHost(hostname: string = window.location.hostname): boolean {
  const host = hostnameOf(hostname)
  return host === BASE_DOMAIN || host === APP_HOST || host === `www.${BASE_DOMAIN}`
}

export function tenantSlugFromHost(hostname: string = window.location.hostname): string | null {
  const host = hostnameOf(hostname)
  const suffix = `.${BASE_DOMAIN}`
  if (!host.endsWith(suffix)) return null
  const label = host.slice(0, -suffix.length)
  if (!label || label.includes('.') || INFRA_LABELS.has(label) || !SLUG_RE.test(label)) {
    return null
  }
  return label
}

export function isDemoHost(hostname: string = window.location.hostname): boolean {
  return tenantSlugFromHost(hostname) === 'demo'
}

export type LoginMode = 'tenant' | 'finder' | 'dev'

export function loginMode(hostname: string = window.location.hostname): LoginMode {
  if (tenantSlugFromHost(hostname)) return 'tenant'
  if (isLocalHost(hostname)) return 'dev'
  if (isSharedHost(hostname)) return 'finder'
  return 'dev'
}

export function tenantOrigin(slug: string): string {
  return `https://${slug}.${BASE_DOMAIN}`
}

export function tenantLoginUrl(slug: string, email?: string): string {
  const url = `${tenantOrigin(slug)}/login`
  if (!email) return url
  return `${url}?email=${encodeURIComponent(email)}`
}

/**
 * Sales contact — still listed as a secondary channel after self-serve signup.
 */
export const SALES_TELEGRAM_HANDLE = '@jasurbeksharofiddinov'
export const SALES_TELEGRAM_URL = 'https://t.me/jasurbeksharofiddinov'
export const SALES_PHONE = '+998 99 994 89 59'
export const SALES_PHONE_HREF = 'tel:+998999948959'

/** Keep in sync with backend TRIAL_LENGTH_DAYS (app.config.Settings). */
export const TRIAL_LENGTH_DAYS = 14
