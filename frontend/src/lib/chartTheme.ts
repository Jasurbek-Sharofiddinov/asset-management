import { useMemo } from 'react'
import { useThemeStore } from '../stores/themeStore'

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const LIGHT_RAMP = [
  '#17233D', '#2B3A5C', '#3F5480', '#5570A2', '#6E8BBB', '#8CA6CE', '#B0C2DD',
]
const DARK_RAMP = [
  '#C5CDD9', '#A8B4C7', '#8B9BB8', '#6E82A3', '#55698A', '#435575', '#354560',
]

export function useChartTheme() {
  const theme = useThemeStore((s) => s.theme)
  return useMemo(() => {
    const brand = cssVar('--av-brand', '#17233D')
    const line = cssVar('--av-line', '#E4E7EC')
    const tick = cssVar('--av-muted', '#79808C')
    const surface = cssVar('--av-surface', '#FFFFFF')
    const ink = cssVar('--av-ink', '#0C0E14')
    return {
      brand,
      line,
      tick,
      surface,
      ink,
      paper: cssVar('--av-paper', '#F6F7F9'),
      seriesRamp: theme === 'dark' ? DARK_RAMP : LIGHT_RAMP,
      tooltipStyle: {
        backgroundColor: surface,
        border: `1px solid ${line}`,
        borderRadius: '10px',
        color: ink,
        fontSize: '12px',
        boxShadow:
          theme === 'dark'
            ? '0 4px 16px rgba(0,0,0,0.35)'
            : '0 4px 16px rgba(12,14,20,0.08)',
      },
    }
  }, [theme])
}
