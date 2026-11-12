/**
 * Display preferences: theme, motion, and density.
 *
 * These are per-browser conveniences, so they live in localStorage rather than
 * on the account. Each one maps to something on <html>:
 *   theme   → `.dark` class + color-scheme  (flips every token in globals/kali.css)
 *   motion  → `data-motion="reduce" | "full"` (absent = follow the OS)
 *   density → `data-density="compact"`        (absent = comfortable)
 * DISPLAY_INIT_SCRIPT runs the same logic inline in <head> before first paint,
 * so a saved choice never flashes the default first.
 *
 * Storage keys keep the original `fluely-` prefix on purpose: renaming them
 * would silently reset everyone's saved choice.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type DensityPreference = 'comfortable' | 'compact';

export interface DisplayPreferences {
  theme: ThemePreference;
  motion: MotionPreference;
  density: DensityPreference;
}

export const THEME_STORAGE_KEY = 'fluely-theme';
const MOTION_STORAGE_KEY = 'fluely-motion';
const DENSITY_STORAGE_KEY = 'fluely-density';
const CHANGE_EVENT = 'fluely-display-change';

const DEFAULTS: DisplayPreferences = {theme: 'light', motion: 'system', density: 'comfortable'};

const ALLOWED = {
  theme: ['light', 'dark', 'system'],
  motion: ['system', 'reduce', 'full'],
  density: ['comfortable', 'compact']
} as const;

const KEYS: Record<keyof DisplayPreferences, string> = {
  theme: THEME_STORAGE_KEY,
  motion: MOTION_STORAGE_KEY,
  density: DENSITY_STORAGE_KEY
};

function read<K extends keyof DisplayPreferences>(key: K): DisplayPreferences[K] {
  if (typeof window === 'undefined') return DEFAULTS[key];
  try {
    const stored = window.localStorage.getItem(KEYS[key]);
    return (ALLOWED[key] as readonly string[]).includes(stored ?? '')
      ? (stored as DisplayPreferences[K])
      : DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function getDisplayPreferences(): DisplayPreferences {
  return {theme: read('theme'), motion: read('motion'), density: read('density')};
}

export function getThemePreference(): ThemePreference {
  return read('theme');
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

export function applyDisplayPreferences(prefs: DisplayPreferences = getDisplayPreferences()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const dark = resolveTheme(prefs.theme) === 'dark';
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  if (prefs.motion === 'system') delete root.dataset.motion;
  else root.dataset.motion = prefs.motion;
  if (prefs.density === 'compact') root.dataset.density = 'compact';
  else delete root.dataset.density;
}

export function setDisplayPreference<K extends keyof DisplayPreferences>(
  key: K,
  value: DisplayPreferences[K]
): void {
  try {
    window.localStorage.setItem(KEYS[key], value);
  } catch {
    // Storage blocked (private mode, policy): the choice still applies for
    // this page view, it just will not be remembered.
  }
  applyDisplayPreferences({...getDisplayPreferences(), [key]: value});
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setThemePreference(pref: ThemePreference): void {
  setDisplayPreference('theme', pref);
}

/** Subscribe for useSyncExternalStore: same-tab changes, other tabs, and OS changes. */
export function subscribeDisplay(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onStorage = (e: StorageEvent) => {
    if (e.key && Object.values(KEYS).includes(e.key)) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', onChange);
  };
}

/**
 * Inline <head> script. Dependency-free and kept in sync with
 * applyDisplayPreferences by hand; it is tiny and runs before React exists.
 */
export const DISPLAY_INIT_SCRIPT = `(function(){try{var s=localStorage,r=document.documentElement;var t=s.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'&&t!=='system')t='${DEFAULTS.theme}';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';var m=s.getItem('${MOTION_STORAGE_KEY}');if(m==='reduce'||m==='full')r.dataset.motion=m;if(s.getItem('${DENSITY_STORAGE_KEY}')==='compact')r.dataset.density='compact';}catch(e){}})();`;
