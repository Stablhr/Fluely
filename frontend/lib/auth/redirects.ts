export type UserType = 'user' | 'admin';

export function getDashboardPath(userType: UserType) {
  if (userType === 'admin') return '/admin/dashboard';
  return '/';
}

/** The `redirect` query param if it is a same-origin path, else null. Client-only. */
export function getSafeRedirect(): string | null {
  const value = new URLSearchParams(window.location.search).get('redirect');
  if (!value || !value.startsWith('/')) return null;
  // Let the URL parser decide, the way the browser will: it strips tabs and
  // newlines and reads `\` as `/`, so "/\t/evil.com" or "/\evil.com" become
  // "//evil.com", another site.
  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  return url.pathname + url.search + url.hash;
}

/** Where to go after authenticating: a safe `redirect` param, else the dashboard. */
export function getPostAuthPath(userType: UserType) {
  return getSafeRedirect() ?? getDashboardPath(userType);
}

/** Carries the current page's safe `redirect` onto `path` (sign-up → verify → sign-in). */
export function withRedirect(path: string) {
  const redirect = getSafeRedirect();
  if (!redirect) return path;
  return `${path}${path.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(redirect)}`;
}
