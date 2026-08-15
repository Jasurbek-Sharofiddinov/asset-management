/**
 * Public site hostname — single source for landing/login labels and demo QR URLs.
 *
 * Set VITE_BASE_DOMAIN at build time (Docker Compose prod passes BASE_DOMAIN).
 * Default matches the destination apex.
 * Tenant app host: {VITE_APP_SUBDOMAIN}.{BASE_DOMAIN} (default asset.*).
 * Platform console host is separate (PLATFORM_SUBDOMAIN / admin.*) — not used here.
 */
export const BASE_DOMAIN =
  (import.meta.env.VITE_BASE_DOMAIN as string | undefined)?.trim() || 'assetvault.uz'

export const APP_SUBDOMAIN =
  (import.meta.env.VITE_APP_SUBDOMAIN as string | undefined)?.trim() || 'asset'

export const APP_HOST = `${APP_SUBDOMAIN}.${BASE_DOMAIN}`
export const APP_ORIGIN = `https://${APP_HOST}`

/**
 * Sales contact — still listed as a secondary channel after self-serve signup.
 */
export const SALES_TELEGRAM_HANDLE = '@jasurbeksharofiddinov'
export const SALES_TELEGRAM_URL = 'https://t.me/jasurbeksharofiddinov'
export const SALES_PHONE = '+998 99 994 89 59'
export const SALES_PHONE_HREF = 'tel:+998999948959'

/** Keep in sync with backend TRIAL_LENGTH_DAYS (app.config.Settings). */
export const TRIAL_LENGTH_DAYS = 14
