import {env} from '../config/env';

/**
 * True when `url` is an https delivery URL on this account's Cloudinary.
 *
 * Media URLs end up in `<img src>`, `<video src>` and CSS `url(...)` in every
 * viewer's browser, so a stored URL pointing anywhere else would let one user
 * make everyone else's browser fetch an arbitrary address (a tracking pixel,
 * for example). Characters that could break out of a CSS `url(...)` are
 * rejected outright.
 */
export function isOwnCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url || /["'()\\\s<>]/.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
    return false;
  }
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  return !cloudName || parsed.pathname.startsWith(`/${cloudName}/`);
}
