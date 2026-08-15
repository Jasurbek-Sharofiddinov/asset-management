import { describe, expect, it } from 'vitest'
import { ALLOWED_TRANSITIONS, canTransition } from './assetStatus'

describe('asset status transitions', () => {
  it('matches the backend table: Registered cannot go Lost', () => {
    expect(canTransition('REGISTERED', 'LOST')).toBe(false)
    expect(ALLOWED_TRANSITIONS.REGISTERED.has('LOST')).toBe(false)
  })

  it('allows Lost to Written Off only', () => {
    expect(canTransition('LOST', 'WRITTEN_OFF')).toBe(true)
    expect([...ALLOWED_TRANSITIONS.LOST]).toEqual(['WRITTEN_OFF'])
  })

  it('treats Written Off as terminal', () => {
    expect(ALLOWED_TRANSITIONS.WRITTEN_OFF.size).toBe(0)
    expect(canTransition('WRITTEN_OFF', 'REGISTERED')).toBe(false)
  })

  it('allows Registered to Assigned, In Repair, and Written Off', () => {
    expect(canTransition('REGISTERED', 'ASSIGNED')).toBe(true)
    expect(canTransition('REGISTERED', 'IN_REPAIR')).toBe(true)
    expect(canTransition('REGISTERED', 'WRITTEN_OFF')).toBe(true)
  })
})
