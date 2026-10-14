import {env} from './env';

/**
 * Token lifetimes, in one place.
 *
 * The access token is deliberately short-lived: the client holds it in an
 * HTTP-only cookie and silently renews it, so nothing the user does depends on
 * its length. The refresh token **is** the session -- it is what lets someone
 * close the app and come back without signing in again -- so its lifetime is
 * the length of a session.
 *
 * The refresh token rolls: every refresh mints a new one with a fresh window,
 * so an account that keeps using the app never gets signed out. Only an account
 * left untouched for the whole window has to sign in again. Set
 * `REFRESH_TOKEN_TTL_DAYS` to tune that window (default 30); a large value,
 * e.g. 365, effectively means "stay signed in until an explicit logout".
 *
 * Lifetimes are seconds for the JWT `expiresIn`; the cookie `maxAge`s are the
 * same durations in milliseconds. They must stay in step: a cookie that
 * outlives its token would keep sending a dead token, and a token that outlives
 * its cookie would be dropped by the browser before it could be used.
 */
const REFRESH_TOKEN_TTL_DAYS = env.REFRESH_TOKEN_TTL_DAYS ?? 30;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ACCESS_TOKEN_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

export const REFRESH_TOKEN_TTL_SECONDS =
  REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
export const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;
