import {env} from '../../../config/env';
import {assertOk, downloadMedia, form, http, json} from './http';
import {ProviderError, PublishInput, SocialProvider, TokenSet} from './types';

/**
 * TikTok Content Posting API (Direct Post). The video is downloaded from
 * Cloudinary and uploaded in chunks (`FILE_UPLOAD`), because `PULL_FROM_URL`
 * requires a domain verified with TikTok. Until TikTok audits the app, only
 * private posts are allowed, which `TIKTOK_PRIVACY` defaults to.
 */

const NAME = 'TikTok';
const API = 'https://open.tiktokapis.com/v2';
const SCOPES = ['user.info.basic', 'video.publish'];
const CHUNK = 10 * 1024 * 1024;

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id: string;
  scope?: string;
};

function toTokenSet(res: TokenResponse): TokenSet {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? null,
    expiresAt: new Date(Date.now() + res.expires_in * 1000),
    scopes: (res.scope ?? '').split(',').filter(Boolean)
  };
}

async function token(values: Record<string, string | undefined>): Promise<TokenResponse> {
  const res = await json<TokenResponse & {error?: string; error_description?: string}>(
    `${API}/oauth/token/`,
    NAME,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: form({client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, ...values})
    }
  );
  if (res.error) {
    throw new ProviderError(`TikTok: ${res.error_description ?? res.error}`, 'TOKEN_INVALID', false, true);
  }
  return res;
}

export const tiktokProvider: SocialProvider = {
  platform: 'tiktok',

  isConfigured: () => Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),

  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY ?? '',
      response_type: 'code',
      scope: SCOPES.join(','),
      redirect_uri: redirectUri,
      state
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const res = await token({grant_type: 'authorization_code', code, redirect_uri: redirectUri});
    const set = toTokenSet(res);
    const info = await json<{data?: {user?: {open_id?: string; display_name?: string; avatar_url?: string}}}>(
      `${API}/user/info/?fields=open_id,display_name,avatar_url`,
      NAME,
      {headers: {Authorization: `Bearer ${set.accessToken}`}}
    );
    const user = info.data?.user ?? {};
    return [
      {
        platformAccountId: res.open_id,
        accountType: 'creator',
        accountName: user.display_name ?? 'TikTok creator',
        profileImageUrl: user.avatar_url,
        token: set
      }
    ];
  },

  async refresh(refreshToken) {
    return toTokenSet(await token({grant_type: 'refresh_token', refresh_token: refreshToken}));
  },

  async publish({account, content}: PublishInput) {
    const video = content.media.find(m => m.type === 'video');
    if (!video?.storageUrl) {
      throw new ProviderError('TikTok posts need a video', 'MEDIA_REQUIRED', false);
    }
    const {bytes, type} = await downloadMedia(video.storageUrl, NAME);
    const size = bytes.length;
    // Files up to 64 MB go in one chunk; larger ones in 10 MB chunks, the last
    // chunk absorbing the remainder (TikTok's rule).
    const chunkSize = size <= 64 * 1024 * 1024 ? size : CHUNK;
    const chunks = Math.max(1, Math.floor(size / chunkSize));

    const init = await json<{data?: {publish_id: string; upload_url: string}; error?: {code: string; message: string}}>(
      `${API}/post/publish/video/init/`,
      NAME,
      {
        method: 'POST',
        headers: {Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8'},
        body: JSON.stringify({
          post_info: {
            title: content.text.slice(0, 2200),
            privacy_level: env.TIKTOK_PRIVACY,
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false
          },
          source_info: {source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: chunks}
        })
      }
    );
    if (!init.data || (init.error && init.error.code !== 'ok')) {
      throw new ProviderError(`TikTok: ${init.error?.message ?? 'could not start the upload'}`, 'REJECTED', false);
    }

    for (let index = 0; index < chunks; index += 1) {
      const start = index * chunkSize;
      const end = index === chunks - 1 ? size : start + chunkSize;
      const res = await http(init.data.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': type.startsWith('video/') ? type : 'video/mp4',
          'Content-Range': `bytes ${start}-${end - 1}/${size}`
        },
        body: bytes.subarray(start, end),
        timeoutMs: 180_000
      });
      await assertOk(res, NAME);
    }
    // TikTok processes the upload asynchronously and gives no URL up front.
    return {externalPostId: init.data.publish_id};
  }
};
