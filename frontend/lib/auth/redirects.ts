export type UserType = 'user' | 'admin';

export function getDashboardPath(userType: UserType) {
  if (userType === 'admin') return '/admin/dashboard';
  return '/';
}

/** The `redirect` query param if it is a same-origin path, else null. Client-only. */
export function getSafeRedirect(): string | null {
  const value = new URLSearchParams(window.location.search).get('redirect');
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
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
