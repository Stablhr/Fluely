import {env} from '../../../config/env';
import {json} from './http';
import {ConnectedAccount, ProviderError} from './types';

/**
 * Instagram API with Unified login -- what Meta gives newer apps instead of
 * "API setup with Instagram login" (no separate Instagram app ID/secret).
 *
 * The person signs in through Facebook Login for Business with the app's
 * Instagram configuration (META_INSTAGRAM_UNIFIED_CONFIG_ID) and picks the
 * Instagram account(s) to share; no Facebook Page is needed, only a business
 * portfolio. The code exchange returns a Business Integration System User
 * token, which by default never expires and is scoped to the picked assets.
 * Publishing then uses graph.facebook.com like the Page-linked route.
 *
 * Docs: developers.facebook.com/documentation/facebook-login/facebook-login-for-business
 */

const NAME = 'Instagram';
/** `accountType` of an Instagram account connected through Unified login. */
export const INSTAGRAM_UNIFIED_TYPE = 'instagram_unified';

const graph = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION}${path}`;

export function instagramUnifiedConfigured(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_INSTAGRAM_UNIFIED_CONFIG_ID);
}

export function instagramUnifiedAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID ?? '',
    redirect_uri: redirectUri,
    state,
    // config_id replaces `scope`, and the dialog must be told to return a code.
    config_id: env.META_INSTAGRAM_UNIFIED_CONFIG_ID ?? '',
    response_type: 'code',
    override_default_response_type: 'true'
  });
  return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params}`;
}

type IgAccount = {id: string; username?: string; name?: string; profile_picture_url?: string};

export async function instagramUnifiedExchangeCode(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
  const tokenRes = await json<{access_token: string; expires_in?: number}>(
    graph(
      `/oauth/access_token?${new URLSearchParams({
        client_id: env.META_APP_ID ?? '',
        client_secret: env.META_APP_SECRET ?? '',
        redirect_uri: redirectUri,
        code
      })}`
    ),
    NAME
  );
  const token = tokenRes.access_token;

  // Granted permissions and expiry (0 = never) from the app's view of the token.
  let scopes: string[] = [];
  let expiresAt: Date | null = null;
  try {
    const debug = await json<{data?: {scopes?: string[]; expires_at?: number}}>(
      graph(
        `/debug_token?${new URLSearchParams({
          input_token: token,
          access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`
        })}`
      ),
      NAME
    );
    scopes = debug.data?.scopes ?? [];
    if (debug.data?.expires_at) expiresAt = new Date(debug.data.expires_at * 1000);
  } catch {
    if (tokenRes.expires_in) expiresAt = new Date(Date.now() + tokenRes.expires_in * 1000);
  }

  // The Instagram accounts picked during sign-in.
  const accounts: IgAccount[] = [];
  let next: string | undefined = graph(
    `/me/assigned_instagram_accounts?${new URLSearchParams({fields: 'id,username', limit: '100', access_token: token})}`
  );
  for (let page = 0; next && page < 10; page += 1) {
    const res: {data?: IgAccount[]; paging?: {next?: string}} = await json(next, NAME);
    accounts.push(...(res.data ?? []));
    next = res.paging?.next;
  }
  if (accounts.length === 0) {
    throw new ProviderError(
      'Instagram: no Instagram account was shared. Pick your account during sign-in; if you did, add the ' +
        'business_management permission to the configuration (Facebook Login for Business > Configurations > Edit) and try again.',
      'NO_INSTAGRAM_ACCOUNT',
      false
    );
  }

  const connected: ConnectedAccount[] = [];
  for (const account of accounts) {
    let profile: IgAccount = account;
    try {
      profile = {
        ...account,
        ...(await json<IgAccount>(
          graph(`/${account.id}?${new URLSearchParams({fields: 'username,name,profile_picture_url', access_token: token})}`),
          NAME
        ))
      };
    } catch {
      // Name and picture are nice to have; the id is what posting needs.
    }
    connected.push({
      platformAccountId: account.id,
      accountType: INSTAGRAM_UNIFIED_TYPE,
      accountName: profile.name || profile.username || 'Instagram account',
      accountUsername: profile.username,
      profileImageUrl: profile.profile_picture_url,
      token: {accessToken: token, refreshToken: null, expiresAt, scopes}
    });
  }
  return connected;
}
