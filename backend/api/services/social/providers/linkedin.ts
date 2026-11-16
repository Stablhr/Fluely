import {env} from '../../../config/env';
import {downloadMedia, form, http, assertOk, json} from './http';
import {ConnectedAccount, ProviderError, PublishInput, SocialProvider, TokenSet} from './types';

/**
 * LinkedIn: personal profiles through "Share on LinkedIn" (`w_member_social`),
 * Company Pages through the Community Management API once LinkedIn approves
 * it (`LINKEDIN_ORGANIZATIONS=true`). Posts use the versioned `/rest/posts`
 * API. Text and images are supported; video is not built yet.
 */

const NAME = 'LinkedIn';
const MEMBER_SCOPES = ['openid', 'profile', 'w_member_social'];
const ORG_SCOPES = ['w_organization_social', 'r_organization_social', 'rw_organization_admin'];

function scopes() {
  return env.LINKEDIN_ORGANIZATIONS ? [...MEMBER_SCOPES, ...ORG_SCOPES] : MEMBER_SCOPES;
}

function restHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': env.LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json'
  };
}

/**
 * LinkedIn's post text is "little text": reserved characters must be escaped,
 * and hashtags are written as a template so they stay clickable.
 */
export function toLittleText(text: string): string {
  const escape = (value: string) => value.replace(/[\\|{}@[\]()<>#*_~]/g, ch => `\\${ch}`);
  const hashtag = /(^|\s)#([\p{L}\p{N}_]+)/gu;
  let out = '';
  let last = 0;
  for (const match of text.matchAll(hashtag)) {
    const start = match.index ?? 0;
    out += escape(text.slice(last, start)) + match[1] + `{hashtag|\\#|${escape(match[2])}}`;
    last = start + match[0].length;
  }
  return out + escape(text.slice(last));
}

async function uploadImage(token: string, owner: string, url: string): Promise<string> {
  const init = await json<{value: {uploadUrl: string; image: string}}>(
    'https://api.linkedin.com/rest/images?action=initializeUpload',
    NAME,
    {
      method: 'POST',
      headers: restHeaders(token),
      body: JSON.stringify({initializeUploadRequest: {owner}})
    }
  );
  const {bytes} = await downloadMedia(url, NAME);
  const put = await http(init.value.uploadUrl, {
    method: 'PUT',
    headers: {Authorization: `Bearer ${token}`},
    body: bytes,
    timeoutMs: 120_000
  });
  await assertOk(put, NAME);
  return init.value.image;
}

export const linkedinProvider: SocialProvider = {
  platform: 'linkedin',

  isConfigured: () => Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),

  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      state,
      scope: scopes().join(' ')
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const tokenRes = await json<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
    }>('https://www.linkedin.com/oauth/v2/accessToken', NAME, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: form({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET
      })
    });
    const token: TokenSet = {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tokenRes.expires_in * 1000),
      scopes: (tokenRes.scope ?? '').split(/[ ,]+/).filter(Boolean)
    };

    const me = await json<{sub: string; name?: string; picture?: string}>(
      'https://api.linkedin.com/v2/userinfo',
      NAME,
      {headers: {Authorization: `Bearer ${token.accessToken}`}}
    );
    const accounts: ConnectedAccount[] = [
      {
        platformAccountId: `urn:li:person:${me.sub}`,
        accountType: 'profile',
        accountName: me.name ?? 'LinkedIn member',
        profileImageUrl: me.picture,
        token
      }
    ];

    // Company Pages the person administers. Only available after LinkedIn
    // approves the Community Management API; a refusal is not fatal.
    if (env.LINKEDIN_ORGANIZATIONS && token.scopes.includes('w_organization_social')) {
      try {
        const acls = await json<{elements?: {organization: string}[]}>(
          'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
          NAME,
          {headers: restHeaders(token.accessToken)}
        );
        for (const acl of acls.elements ?? []) {
          const id = acl.organization.split(':').pop();
          const org = await json<{localizedName?: string; vanityName?: string}>(
            `https://api.linkedin.com/rest/organizations/${id}`,
            NAME,
            {headers: restHeaders(token.accessToken)}
          );
          accounts.push({
            platformAccountId: acl.organization,
            accountType: 'organization',
            accountName: org.localizedName ?? 'LinkedIn Page',
            accountUsername: org.vanityName,
            token
          });
        }
      } catch {
        // Keep the personal profile even if Pages could not be listed.
      }
    }
    return accounts;
  },

  async refresh(refreshToken) {
    const res = await json<{access_token: string; expires_in: number; refresh_token?: string}>(
      'https://www.linkedin.com/oauth/v2/accessToken',
      NAME,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: form({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: env.LINKEDIN_CLIENT_ID,
          client_secret: env.LINKEDIN_CLIENT_SECRET
        })
      }
    );
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + res.expires_in * 1000),
      scopes: []
    };
  },

  async publish({account, content}: PublishInput) {
    const token = account.accessToken;
    const author = account.platformAccountId;
    if (content.media.some(m => m.type !== 'image')) {
      throw new ProviderError('LinkedIn: only text and image posts are supported for now', 'UNSUPPORTED_MEDIA', false);
    }
    const images: string[] = [];
    for (const item of content.media.slice(0, 20)) {
      images.push(await uploadImage(token, author, item.storageUrl as string));
    }

    const body: Record<string, unknown> = {
      author,
      commentary: toLittleText(content.text),
      visibility: 'PUBLIC',
      distribution: {feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: []},
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false
    };
    if (images.length === 1) {
      body.content = {media: {id: images[0], altText: content.altText ?? ''}};
    } else if (images.length > 1) {
      body.content = {multiImage: {images: images.map(id => ({id, altText: content.altText ?? ''}))}};
    }

    const res = await http('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: restHeaders(token),
      body: JSON.stringify(body)
    });
    await assertOk(res, NAME);
    const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? '';
    return {
      externalPostId: urn,
      publishedUrl: urn ? `https://www.linkedin.com/feed/update/${urn}/` : undefined
    };
  }
};
