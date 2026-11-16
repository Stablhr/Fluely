import {env} from '../config/env';

/*
 * Auth cookie names. The prefix comes from COOKIE_PREFIX (default "dc", which
 * is what production has always used, so existing sessions keep working).
 * Browsers share cookies across every port of a host, so another local app
 * using the same names would overwrite these; set a different prefix locally.
 */
const prefix = env.COOKIE_PREFIX ?? 'dc';

export const ACCESS_TOKEN_COOKIE = `${prefix}_access_token`;
export const REFRESH_TOKEN_COOKIE = `${prefix}_refresh_token`;
export const CSRF_COOKIE = `${prefix}_csrf_token`;
