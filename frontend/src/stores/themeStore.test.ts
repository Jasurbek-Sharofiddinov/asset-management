import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, useThemeStore } from '../stores/themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    useThemeStore.setState({ theme: 'light' })
    applyTheme('light')
  })

  it('toggles dark class and persists the choice', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
