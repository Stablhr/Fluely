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

/** Point the theme change spreads out from, in viewport pixels. */
export type ThemeOrigin = {x: number; y: number};

const REVEAL_MS = 560;
const FADE_MS = 320;

function motionReduced(): boolean {
  const pref = getDisplayPreferences().motion;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => {ready: Promise<void>; finished: Promise<void>};
};

/**
 * Switches the theme with an animation when the visible colors actually change:
 * - browsers with the View Transitions API: the new theme spreads out as a
 *   circle from `origin` (the click) until it covers the screen;
 * - other browsers: every color cross-fades for FADE_MS;
 * - reduced motion, or a change that resolves to the same theme (e.g. Light
 *   to System on a light OS): applied instantly.
 *
 * `run` wraps the update; React callers pass `(apply) => flushSync(apply)` so
 * their re-render lands in the snapshot the transition animates to rather than
 * a frame later. (Kept out of this module so it stays importable from server
 * components, which only need DISPLAY_INIT_SCRIPT.)
 */
export function setThemePreference(
  pref: ThemePreference,
  origin?: ThemeOrigin,
  run: (apply: () => void) => void = (apply) => apply()
): void {
  const apply = () => run(() => setDisplayPreference('theme', pref));

  const changesColors = resolveTheme(getThemePreference()) !== resolveTheme(pref);
  if (!changesColors || motionReduced()) {
    apply();
    return;
  }

  const doc = document as ViewTransitionDoc;
  if (!doc.startViewTransition) {
    const root = document.documentElement;
    root.classList.add('theme-fading');
    apply();
    window.setTimeout(() => root.classList.remove('theme-fading'), FADE_MS + 40);
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  // Radius that reaches the farthest corner from the origin.
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(apply);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        {clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]},
        {duration: REVEAL_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)'}
      );
    })
    .catch(() => {
      // The transition was skipped (e.g. tab hidden); the theme is applied anyway.
    });
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
