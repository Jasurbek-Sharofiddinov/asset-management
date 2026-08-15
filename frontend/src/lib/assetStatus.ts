import type { AssetStatus } from '../types'

/** Mirrors backend/app/services/asset_service.py ALLOWED_TRANSITIONS. */
export const ALLOWED_TRANSITIONS: Record<AssetStatus, ReadonlySet<AssetStatus>> = {
  REGISTERED: new Set(['ASSIGNED', 'IN_REPAIR', 'WRITTEN_OFF']),
  ASSIGNED: new Set(['REGISTERED', 'IN_REPAIR', 'LOST']),
  IN_REPAIR: new Set(['ASSIGNED', 'REGISTERED', 'WRITTEN_OFF']),
  LOST: new Set(['WRITTEN_OFF']),
  WRITTEN_OFF: new Set(),
}

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false
}

export function allowedNextStatuses(from: AssetStatus): AssetStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])]
}
