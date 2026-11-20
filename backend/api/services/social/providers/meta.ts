import {env} from '../../../config/env';
import {form, json, sleep} from './http';
import {ConnectedAccount, ProviderError, PublishInput, SocialProvider} from './types';

/**
 * Facebook Pages and Instagram business/creator accounts share one Meta app
 * and one sign-in (Facebook Login for Business). A sign-in lists the Pages
 * the person manages; each Page token is long-lived and posts as the Page.
 * Instagram accounts are reached through the Page they are linked to.
 */

/**
 * Each platform asks only for what it needs. A Facebook-only Meta app has no
 * Instagram permissions, and Meta rejects a sign-in that asks for permissions
 * the app does not have ("Invalid Scopes").
 */
const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'];
const INSTAGRAM_ONLY_SCOPES = ['instagram_basic', 'instagram_content_publish'];
const INSTAGRAM_SCOPES = [...FACEBOOK_SCOPES, ...INSTAGRAM_ONLY_SCOPES];

/**
 * When switched on (META_FACEBOOK_INCLUDES_INSTAGRAM=true), connecting
 * Facebook also asks for the Instagram permissions and connects the
 * Instagram accounts linked to the shared Pages. Off by default: Meta refuses
 * the whole sign-in ("Invalid Scopes") if the app lacks instagram_basic and
 * instagram_content_publish, which would stop Facebook from connecting at all.
 */
export function instagramWithFacebook(): boolean {
  return env.META_FACEBOOK_INCLUDES_INSTAGRAM === 'true' && env.INSTAGRAM_MODE !== 'disabled';
}
const facebookScopes = () => (instagramWithFacebook() ? INSTAGRAM_SCOPES : FACEBOOK_SCOPES);

const graph = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION}${path}`;

/**
 * Facebook Login for Business can use a saved "configuration" (config_id)
 * instead of a list of permissions; when one is set it takes precedence.
 */
const authorizeUrlFor =
  (scopes: () => string[], configId: () => string | undefined) => (state: string, redirectUri: string) => {
    const params = new URLSearchParams({
      client_id: env.META_APP_ID ?? '',
      redirect_uri: redirectUri,
      state,
      response_type: 'code'
    });
    const config = configId();
    if (config) params.set('config_id', config);
    else params.set('scope', scopes().join(','));
    return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params}`;
  };

export type PageRow = {
  id: string;
  name: string;
  access_token: string;
  picture?: {data?: {url?: string}};
  instagram_business_account?: {id: string; username?: string; profile_picture_url?: string; name?: string};
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
  const fields =
    'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}';
  const pages = await json<{data: PageRow[]}>(
    graph(`/me/accounts?${new URLSearchParams({fields, limit: '100', access_token: long.access_token})}`),
    label
  );
  return {pages: pages.data ?? [], scopes};
}

/**
 * The accounts a Facebook sign-in yields: each shared Page, plus -- when
 * Instagram is on -- the Instagram professional account linked to a Page,
 * which posts with that Page's token.
 */
export function accountsFromPages(pages: PageRow[], scopes: string[], withInstagram: boolean): ConnectedAccount[] {
  const accounts: ConnectedAccount[] = pages.map(page => ({
    platformAccountId: page.id,
    accountType: 'page',
    accountName: page.name,
    profileImageUrl: page.picture?.data?.url,
    token: {accessToken: page.access_token, expiresAt: null, scopes}
  }));
  if (withInstagram) {
    for (const page of pages) {
      const ig = page.instagram_business_account;
      if (!ig?.id) continue;
      accounts.push({
        platform: 'instagram',
        platformAccountId: ig.id,
        accountType: 'business',
        accountName: ig.name || ig.username || page.name,
        accountUsername: ig.username,
        profileImageUrl: ig.profile_picture_url,
        token: {accessToken: page.access_token, expiresAt: null, scopes}
      });
    }
  }
  return accounts;
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
  authorizeUrl: authorizeUrlFor(facebookScopes, () => env.META_LOGIN_CONFIG_ID),

  async exchangeCode(code, redirectUri) {
    const {pages, scopes} = await listPages(code, redirectUri, 'Facebook', facebookScopes());
    if (pages.length === 0) {
      throw new ProviderError(
        'Facebook: no Pages were shared. Facebook only allows posting to Pages you manage.',
        'NO_PAGES',
        false
      );
    }
    return accountsFromPages(pages, scopes, instagramWithFacebook());
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

/** `accountType` of an Instagram account connected with Instagram Login (no Facebook Page). */
export const INSTAGRAM_LOGIN_TYPE = 'instagram_login';

/**
 * Instagram is reached at two addresses: through Facebook (graph.facebook.com,
 * with the linked Page's token) or directly (graph.instagram.com, with an
 * Instagram Login token). The calls are otherwise the same.
 */
export function instagramApiBase(accountType: string): string {
  return accountType === INSTAGRAM_LOGIN_TYPE
    ? `https://graph.instagram.com/${env.META_GRAPH_VERSION}`
    : `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;
}

/**
 * Instagram accepts only JPEG images. Cloudinary converts on delivery when
 * the extension says so, so other formats are requested as .jpg.
 */
export function asInstagramImageUrl(url: string | undefined): string | undefined {
  if (!url || !/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  return /\.jpe?g(\?|$)/i.test(url) ? url : url.replace(/(\.[a-z0-9]+)?(\?.*)?$/i, '.jpg$2');
}

/** Instagram containers for video (and carousels) are processed asynchronously. */
async function waitForContainer(base: string, id: string, token: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await json<{status_code?: string; status?: string}>(
      `${base}/${id}?${new URLSearchParams({fields: 'status_code,status', access_token: token})}`,
      'Instagram'
    );
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new ProviderError(`Instagram could not process the media: ${status.status ?? status.status_code}`, 'MEDIA_REJECTED', false);
    }
    await sleep(3000);
  }
  throw new ProviderError('Instagram is still processing the video; will try again', 'MEDIA_PROCESSING', true);
}

async function postTo(url: string, values: Record<string, string | undefined>) {
  return json<Record<string, string>>(url, 'Instagram', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form(values)
  });
}

/** Create container(s) → wait until processed → publish → fetch the permalink. */
export async function publishToInstagram({account, content}: PublishInput) {
  const base = instagramApiBase(account.accountType);
  const igId = account.platformAccountId;
  const token = account.accessToken;
  const media = content.media.filter(m => m.type === 'image' || m.type === 'video').slice(0, 10);

  const containerFor = async (item: (typeof media)[number], carouselItem: boolean) => {
    const values: Record<string, string | undefined> =
      item.type === 'video'
        ? {media_type: carouselItem ? 'VIDEO' : 'REELS', video_url: item.storageUrl}
        : {image_url: asInstagramImageUrl(item.storageUrl), alt_text: content.altText};
    if (carouselItem) values.is_carousel_item = 'true';
    else values.caption = content.text;
    values.access_token = token;
    const res = await postTo(`${base}/${igId}/media`, values);
    if (item.type === 'video') await waitForContainer(base, res.id, token);
    return res.id;
  };

  let creationId: string;
  if (media.length === 1) {
    creationId = await containerFor(media[0], false);
  } else {
    const children: string[] = [];
    for (const item of media) children.push(await containerFor(item, true));
    const carousel = await postTo(`${base}/${igId}/media`, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption: content.text,
      access_token: token
    });
    await waitForContainer(base, carousel.id, token);
    creationId = carousel.id;
  }

  const published = await postTo(`${base}/${igId}/media_publish`, {creation_id: creationId, access_token: token});
  let permalink: string | undefined;
  try {
    const meta = await json<{permalink?: string}>(
      `${base}/${published.id}?${new URLSearchParams({fields: 'permalink', access_token: token})}`,
      'Instagram'
    );
    permalink = meta.permalink;
  } catch {
    // The post is out; a missing link is not a failure.
  }
  return {externalPostId: published.id, publishedUrl: permalink};
}

export const instagramProvider: SocialProvider = {
  platform: 'instagram',
  isConfigured: () => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  authorizeUrl: authorizeUrlFor(() => INSTAGRAM_SCOPES, () => env.META_INSTAGRAM_CONFIG_ID),

  async exchangeCode(code, redirectUri) {
    const {pages, scopes} = await listPages(code, redirectUri, 'Instagram', INSTAGRAM_SCOPES);
    const linked = pages.filter(page => page.instagram_business_account);
    if (linked.length === 0) {
      throw new ProviderError(
        'Instagram: no business or creator account linked to a Facebook Page was shared. Use "Connect with Instagram" instead.',
        'NO_INSTAGRAM_ACCOUNT',
        false
      );
    }
    return linked.map<ConnectedAccount>(page => {
      const ig = page.instagram_business_account!;
      return {
        platformAccountId: ig.id,
        accountType: 'business',
        accountName: ig.name || ig.username || page.name,
        accountUsername: ig.username,
        profileImageUrl: ig.profile_picture_url,
        token: {accessToken: page.access_token, expiresAt: null, scopes}
      };
    });
  },

  publish: publishToInstagram
};
