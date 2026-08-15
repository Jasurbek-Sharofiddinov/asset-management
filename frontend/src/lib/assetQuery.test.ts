import { describe, expect, it } from 'vitest'
import { buildAssetQueryParams } from './assetQuery'

describe('buildAssetQueryParams', () => {
  it('sends every selected status as an array, not only when length is 1', () => {
    const params = buildAssetQueryParams({
      statuses: ['ASSIGNED', 'LOST'],
      categories: ['IT', 'OFFICE'],
    })
    expect(params.status).toEqual(['ASSIGNED', 'LOST'])
    expect(params.category).toEqual(['IT', 'OFFICE'])
  })

  it('omits empty filter lists', () => {
    const params = buildAssetQueryParams({ statuses: [], categories: [] })
    expect(params.status).toBeUndefined()
    expect(params.category).toBeUndefined()
  })
})
