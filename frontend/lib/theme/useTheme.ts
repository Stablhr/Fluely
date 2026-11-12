'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  applyDisplayPreferences,
  getDisplayPreferences,
  resolveTheme,
  setDisplayPreference,
  setThemePreference,
  subscribeDisplay,
  type DensityPreference,
  type MotionPreference,
  type ThemePreference,
} from './theme';

/* One string snapshot so useSyncExternalStore can compare by value. It carries
   the resolved theme too, so an OS switch while "System" is chosen re-renders
   subscribers even though nothing stored changed. */
const getSnapshot = () => {
  const p = getDisplayPreferences();
  return `${p.theme}:${resolveTheme(p.theme)}:${p.motion}:${p.density}`;
};
const getServerSnapshot = () => 'light:light:system:comfortable';

function useDisplaySnapshot() {
  const [theme, resolved, motion, density] = useSyncExternalStore(
    subscribeDisplay,
    getSnapshot,
    getServerSnapshot,
  ).split(':') as [ThemePreference, 'light' | 'dark', MotionPreference, DensityPreference];
  return { theme, resolved, motion, density };
}

/** The stored theme, what it resolves to now, and a setter. */
export function useThemePreference() {
  const { theme, resolved } = useDisplaySnapshot();
  return { preference: theme, resolved, setPreference: setThemePreference };
}

/** All display preferences plus a setter for each. */
export function useDisplayPreferences() {
  const snapshot = useDisplaySnapshot();
  return {
    ...snapshot,
    setMotion: (value: MotionPreference) => setDisplayPreference('motion', value),
    setDensity: (value: DensityPreference) => setDisplayPreference('density', value),
  };
}

/**
 * Keeps <html> in step with the preferences after first paint: an OS switch
 * while "System" is chosen, or a change made in another tab. Renders nothing.
 */
export function ThemeSync() {
  useEffect(() => {
    applyDisplayPreferences();
    return subscribeDisplay(() => applyDisplayPreferences());
  }, []);
  return null;
}
