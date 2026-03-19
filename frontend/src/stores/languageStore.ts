import { create } from 'zustand'
import { translations, type Locale, type TranslationKey } from '../i18n/translations'

interface LanguageState {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const getInitialLocale = (): Locale => {
  const stored = localStorage.getItem('locale')
  if (stored === 'en' || stored === 'ru' || stored === 'uz') return stored
  return 'en'
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  locale: getInitialLocale(),

  setLocale: (locale: Locale) => {
    localStorage.setItem('locale', locale)
    set({ locale })
  },

  t: (key: TranslationKey) => {
    const { locale } = get()
    const value = translations[locale]?.[key]
    if (value) return value
    // Fallback to English
    return translations.en[key] || key
  },
}))
