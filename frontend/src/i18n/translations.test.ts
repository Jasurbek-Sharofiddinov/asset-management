import { describe, expect, it } from 'vitest'
import { translations } from './translations'

describe('i18n keys', () => {
  it('defines Settings reference-data labels in Uzbek', () => {
    expect(translations.uz['settings.departments']).toBeTruthy()
    expect(translations.uz['settings.departments']).not.toBe('Departments')
    expect(translations.uz['settings.branches']).toBeTruthy()
    expect(translations.uz['settings.employees']).toBeTruthy()
  })

  it('defines tenant chrome keys used by the pages we wired', () => {
    for (const locale of ['en', 'ru', 'uz'] as const) {
      expect(translations[locale]['detail.assignments']).toBeTruthy()
      expect(translations[locale]['validation.branchRequired']).toBeTruthy()
      expect(translations[locale]['login.orgSlugLabel']).toBeTruthy()
      expect(translations[locale]['scanner.title']).toBeTruthy()
      expect(translations[locale]['admin.signIn']).toBeTruthy()
    }
  })

  it('uses Branch is required in English for AssignmentPanel validation', () => {
    expect(translations.en['validation.branchRequired']).toBe('Branch is required')
  })
})
