import {env} from '../../../config/env';
import {form, json} from './http';
import {INSTAGRAM_LOGIN_TYPE} from './meta';
import {ConnectedAccount, ProviderError, TokenSet} from './types';

/**
 * Instagram API with Instagram Login: connects a professional (Business or
 * Creator) Instagram account directly, without a Facebook Page. Used for
 * accounts that are not linked to Facebook; linked ones also connect through
 * Facebook. Personal accounts cannot be connected by any route.
 *
 * Tokens: the code gives a 1-hour token, exchanged at once for a 60-day one.
 * A 60-day token can be refreshed once it is 24 hours old, for another 60
 * days; one left unrefreshed for 60 days expires for good.
 *
 * Docs: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

const NAME = 'Instagram';
export const INSTAGRAM_LOGIN_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];
const SIXTY_DAYS_S = 60 * 24 * 60 * 60;

export function instagramLoginConfigured(): boolean {
  return Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);
}

export function instagramLoginAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_LOGIN_SCOPES.join(','),
    state,
    // Sign in with Instagram itself, not through Facebook.
    enable_fb_login: 'false'
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

type LongLived = {access_token: string; expires_in?: number};

function toTokenSet(res: LongLived, scopes: string[]): TokenSet {
  return {
    accessToken: res.access_token,
    // Instagram refreshes with the long-lived token itself.
    refreshToken: res.access_token,
    expiresAt: new Date(Date.now() + (res.expires_in ?? SIXTY_DAYS_S) * 1000),
    scopes
  };
}

export async function instagramLoginExchangeCode(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
  // 1. Code → short-lived token. The response is documented as wrapped in
  //    `data: [...]`; accept the flat shape too.
  const raw = await json<{
    data?: {access_token: string; user_id: string | number; permissions?: string}[];
    access_token?: string;
    user_id?: string | number;
    permissions?: string | string[];
  }>('https://api.instagram.com/oauth/access_token', NAME, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form({
      client_id: env.INSTAGRAM_APP_ID,
      client_secret: env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, '')
    })
  });
  const short = raw.data?.[0] ?? raw;
  if (!short?.access_token) throw new ProviderError('Instagram did not return a sign-in token', 'TOKEN_INVALID', false);
  const permissions = Array.isArray(short.permissions)
    ? short.permissions
    : String(short.permissions ?? INSTAGRAM_LOGIN_SCOPES.join(',')).split(',').filter(Boolean);

  // 2. Short-lived → 60-day token.
  const long = await json<LongLived>(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: env.INSTAGRAM_APP_SECRET ?? '',
      access_token: short.access_token
    })}`,
    NAME
  );
  const token = toTokenSet(long, permissions);

  // 3. Who is it? `user_id` is the professional account id used for posting
  //    (`id` is only app-scoped).
  const me = await json<{
    data?: Profile[];
  } & Profile>(
    `https://graph.instagram.com/${env.META_GRAPH_VERSION}/me?${new URLSearchParams({
      fields: 'user_id,username,name,profile_picture_url,account_type',
      access_token: token.accessToken
    })}`,
    NAME
  );
  const profile: Profile = me.data?.[0] ?? me;
  const igId = String(profile.user_id ?? short.user_id ?? '');
  if (!igId) throw new ProviderError('Instagram did not return the account id', 'PLATFORM_UNAVAILABLE', true);

  return [
    {
      platformAccountId: igId,
      accountType: INSTAGRAM_LOGIN_TYPE,
      accountName: profile.name || profile.username || 'Instagram account',
      accountUsername: profile.username,
      profileImageUrl: profile.profile_picture_url,
      token
    }
  ];
}

type Profile = {
  user_id?: string | number;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
};

/** Extends a 60-day token by another 60 days (it must be at least 24 hours old). */
export async function instagramLoginRefresh(longLivedToken: string): Promise<TokenSet> {
  const res = await json<LongLived>(
    `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: longLivedToken
    })}`,
    NAME
  );
  return toTokenSet(res, INSTAGRAM_LOGIN_SCOPES);
}
