import {env} from '../../../config/env';
import {form, json} from './http';
import {ConnectedAccount, ProviderError, PublishInput, SocialProvider} from './types';

/**
 * Facebook Pages, through one Meta app and Facebook Login for Business. A
 * sign-in lists the Pages the person manages; each Page token is long-lived
 * and posts as the Page. Facebook does not let apps post to personal
 * profiles (use a reminder account for those).
 */

/** Page permissions only: Meta refuses a sign-in asking for permissions the app lacks. */
const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'];

const graph = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION}${path}`;

/**
 * Facebook Login for Business can use a saved "configuration" (config_id)
 * instead of a list of permissions; when one is set it takes precedence.
 */
const authorizeUrlFor =
  (scopes: string[], configId: () => string | undefined) => (state: string, redirectUri: string) => {
    const params = new URLSearchParams({
      client_id: env.META_APP_ID ?? '',
      redirect_uri: redirectUri,
      state,
      response_type: 'code'
    });
    const config = configId();
    if (config) params.set('config_id', config);
    else params.set('scope', scopes.join(','));
    return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params}`;
  };

export type PageRow = {
  id: string;
  name: string;
  access_token: string;
  picture?: {data?: {url?: string}};
};

/** Code → long-lived user token → the Pages (with Page tokens) it can manage. */
async function listPages(
  code: string,
  redirectUri: string,
  label: string,
  scopes: string[]
): Promise<{pages: PageRow[]; scopes: string[]}> {
  const short = await json<{access_token: string}>(
    graph(
      `/oauth/access_token?${new URLSearchParams({
        client_id: env.META_APP_ID ?? '',
        client_secret: env.META_APP_SECRET ?? '',
        redirect_uri: redirectUri,
        code
      })}`
    ),
    label
  );
  const long = await json<{access_token: string}>(
    graph(
      `/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: env.META_APP_ID ?? '',
        client_secret: env.META_APP_SECRET ?? '',
        fb_exchange_token: short.access_token
      })}`
    ),
    label
  );
  const fields = 'id,name,access_token,picture{url}';
  const pages = await json<{data: PageRow[]}>(
    graph(`/me/accounts?${new URLSearchParams({fields, limit: '100', access_token: long.access_token})}`),
    label
  );
  return {pages: pages.data ?? [], scopes};
}

/** The accounts a Facebook sign-in yields: one per shared Page. */
export function accountsFromPages(pages: PageRow[], scopes: string[]): ConnectedAccount[] {
  return pages.map(page => ({
    platformAccountId: page.id,
    accountType: 'page',
    accountName: page.name,
    profileImageUrl: page.picture?.data?.url,
    token: {accessToken: page.access_token, expiresAt: null, scopes}
  }));
}

async function post(path: string, label: string, values: Record<string, string | undefined>) {
  return json<Record<string, string>>(graph(path), label, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form(values)
  });
}

export const facebookProvider: SocialProvider = {
  platform: 'facebook',
  isConfigured: () => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  authorizeUrl: authorizeUrlFor(FACEBOOK_SCOPES, () => env.META_LOGIN_CONFIG_ID),

  async exchangeCode(code, redirectUri) {
    const {pages, scopes} = await listPages(code, redirectUri, 'Facebook', FACEBOOK_SCOPES);
    if (pages.length === 0) {
      throw new ProviderError(
        'Facebook: no Pages were shared. Facebook only allows posting to Pages you manage.',
        'NO_PAGES',
        false
      );
    }
    return accountsFromPages(pages, scopes);
  },

  async publish({account, content}: PublishInput) {
    const pageId = account.platformAccountId;
    const token = account.accessToken;
    const images = content.media.filter(m => m.type === 'image');
    const video = content.media.find(m => m.type === 'video');

    if (video) {
      const res = await post(`/${pageId}/videos`, 'Facebook', {
        file_url: video.storageUrl,
        title: content.title || undefined,
        description: content.text,
        access_token: token
      });
      return {externalPostId: res.id, publishedUrl: `https://www.facebook.com/${pageId}/videos/${res.id}`};
    }
    if (images.length === 1) {
      const res = await post(`/${pageId}/photos`, 'Facebook', {
        url: images[0].storageUrl,
        caption: content.text,
        access_token: token
      });
      const id = res.post_id ?? res.id;
      return {externalPostId: id, publishedUrl: `https://www.facebook.com/${id}`};
    }
    const values: Record<string, string | undefined> = {message: content.text, link: content.link, access_token: token};
    // Several photos: upload each unpublished, then attach them to one post.
    for (let i = 0; i < images.length; i += 1) {
      const photo = await post(`/${pageId}/photos`, 'Facebook', {
        url: images[i].storageUrl,
        published: 'false',
        access_token: token
      });
      values[`attached_media[${i}]`] = JSON.stringify({media_fbid: photo.id});
    }
    const res = await post(`/${pageId}/feed`, 'Facebook', values);
    return {externalPostId: res.id, publishedUrl: `https://www.facebook.com/${res.id}`};
  }
};
