'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from './theme';

/* The snapshot carries the resolved theme too, so an OS switch while "System"
   is chosen re-renders subscribers even though the stored value did not change. */
const getSnapshot = () => {
  const preference = getThemePreference();
  return `${preference}:${resolveTheme(preference)}`;
};
const getServerSnapshot = () => 'light:light';

/** The stored preference, what it resolves to now, and a setter. */
export function useThemePreference() {
  const [preference, resolved] = useSyncExternalStore(
    subscribeTheme,
    getSnapshot,
    getServerSnapshot,
  ).split(':') as [ThemePreference, 'light' | 'dark'];
  return { preference, resolved, setPreference: setThemePreference };
}

/**
 * Keeps <html> in step with the preference after first paint: an OS switch
 * while "System" is chosen, or a change made in another tab. Renders nothing.
 */
export function ThemeSync() {
  useEffect(() => {
    applyTheme();
    return subscribeTheme(() => applyTheme());
  }, []);
  return null;
}
