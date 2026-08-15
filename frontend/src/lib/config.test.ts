import { describe, expect, it } from 'vitest'
import {
  APP_HOST,
  BASE_DOMAIN,
  isLocalHost,
  isSharedHost,
  loginMode,
  tenantLoginUrl,
  tenantOrigin,
  tenantSlugFromHost,
} from './config'

describe('host helpers', () => {
  it('treats localhost variants as local', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1:5173')).toBe(true)
    expect(isLocalHost('localhost:5173')).toBe(true)
    expect(isLocalHost('app.assetvault.uz')).toBe(false)
  })

  it('treats apex, app, and www as shared finder hosts', () => {
    expect(isSharedHost(BASE_DOMAIN)).toBe(true)
    expect(isSharedHost(APP_HOST)).toBe(true)
    expect(isSharedHost(`www.${BASE_DOMAIN}`)).toBe(true)
    expect(isSharedHost(`demo.${BASE_DOMAIN}`)).toBe(false)
  })

  it('binds a single-label workspace slug and ignores infra labels', () => {
    expect(tenantSlugFromHost(`acme.${BASE_DOMAIN}`)).toBe('acme')
    expect(tenantSlugFromHost(`demo.${BASE_DOMAIN}`)).toBe('demo')
    expect(tenantSlugFromHost(APP_HOST)).toBeNull()
    expect(tenantSlugFromHost(`admin.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(`www.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(`default.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(`foo.bar.${BASE_DOMAIN}`)).toBeNull()
    expect(tenantSlugFromHost(BASE_DOMAIN)).toBeNull()
  })

  it('picks login mode from the hostname', () => {
    expect(loginMode(`acme.${BASE_DOMAIN}`)).toBe('tenant')
    expect(loginMode(APP_HOST)).toBe('finder')
    expect(loginMode('localhost')).toBe('dev')
  })

  it('builds a tenant login URL with optional email', () => {
    expect(tenantOrigin('acme')).toBe('https://acme.assetvault.uz')
    expect(tenantLoginUrl('acme')).toBe('https://acme.assetvault.uz/login')
    expect(tenantLoginUrl('acme', 'a@b.c')).toBe(
      'https://acme.assetvault.uz/login?email=a%40b.c',
    )
  })
})
