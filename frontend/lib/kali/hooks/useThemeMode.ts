'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/kali/store/useStore'

/**
 * Applies the `dark` class to <html> based on the user's stored preference.
 * On first load (no stored preference), the OS preference is used as the default.
 */
export function useThemeMode(): 'light' | 'dark' {
  const { data } = useStore()
  const mode = data.ui.darkMode ?? 'light'

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [mode])

  return mode
}
