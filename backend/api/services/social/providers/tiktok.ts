import {env} from '../../../config/env';
import {assertOk, downloadMedia, form, http, json, sleep} from './http';
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

/**
 * The privacy level to post with: the configured one if this creator may use
 * it, else private ("Only me", what unaudited apps are limited to), else none.
 */
export function pickTikTokPrivacy(wanted: string, allowed: string[]): string | null {
  if (allowed.length === 0) return wanted;
  if (allowed.includes(wanted)) return wanted;
  if (allowed.includes('SELF_ONLY')) return 'SELF_ONLY';
  return null;
}

/** Plain-language versions of the TikTok refusals people actually hit. */
export function explainTikTokError(error: unknown): unknown {
  if (!(error instanceof ProviderError)) return error;
  const known: Record<string, string> = {
    unaudited_client_can_only_post_to_private_accounts:
      "TikTok only lets apps it hasn't audited yet post to private accounts. Set the TikTok account to private (Settings → Privacy), or apply for TikTok's audit.",
    reached_active_user_cap: 'TikTok: this app has reached its daily limit of accounts that can post. Try again tomorrow.',
    spam_risk_too_many_posts: 'TikTok: this account has posted too many times today. Try again tomorrow.',
    privacy_level_option_mismatch: "TikTok: this account doesn't allow the privacy setting Fluely used.",
    scope_not_authorized: 'TikTok: posting permission was not granted. Reconnect the account and allow posting.'
  };
  const code = Object.keys(known).find(key => error.message.includes(key));
  if (!code) return error;
  const retryable = code === 'reached_active_user_cap' || code === 'spam_risk_too_many_posts';
  return new ProviderError(known[code], code.toUpperCase(), retryable, code === 'scope_not_authorized');
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
    const auth = {Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8'};

    // TikTok requires asking first what this creator may post: which privacy
    // levels, whether comments/duets/stitches are allowed, and how long a video
    // can be.
    const creator = await json<{
      data?: {
        privacy_level_options?: string[];
        comment_disabled?: boolean;
        duet_disabled?: boolean;
        stitch_disabled?: boolean;
        max_video_post_duration_sec?: number;
      };
    }>(`${API}/post/publish/creator_info/query/`, NAME, {method: 'POST', headers: auth, body: '{}'});
    const options = creator.data?.privacy_level_options ?? [];
    const privacy = pickTikTokPrivacy(env.TIKTOK_PRIVACY, options);
    if (!privacy) {
      throw new ProviderError(
        `TikTok: this account can't post with the privacy setting Fluely uses (${env.TIKTOK_PRIVACY}).`,
        'PRIVACY_NOT_ALLOWED',
        false
      );
    }
    const maxSeconds = creator.data?.max_video_post_duration_sec;
    if (maxSeconds && video.duration && video.duration > maxSeconds) {
      throw new ProviderError(
        `TikTok: this account can post videos up to ${Math.floor(maxSeconds / 60)} min; this one is longer.`,
        'VIDEO_TOO_LONG',
        false
      );
    }

    const {bytes, type} = await downloadMedia(video.storageUrl, NAME);
    const size = bytes.length;
    // Files up to 64 MB go in one chunk; larger ones in 10 MB chunks, the last
    // chunk absorbing the remainder (TikTok's rule).
    const chunkSize = size <= 64 * 1024 * 1024 ? size : CHUNK;
    const chunks = Math.max(1, Math.floor(size / chunkSize));

    let init: {data?: {publish_id: string; upload_url: string}; error?: {code: string; message: string}};
    try {
      init = await json(`${API}/post/publish/video/init/`, NAME, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          post_info: {
            title: content.text.slice(0, 2200),
            privacy_level: privacy,
            // Off unless the creator has turned them off in TikTok.
            disable_comment: Boolean(creator.data?.comment_disabled),
            disable_duet: Boolean(creator.data?.duet_disabled),
            disable_stitch: Boolean(creator.data?.stitch_disabled)
          },
          source_info: {source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: chunks}
        })
      });
    } catch (error) {
      throw explainTikTokError(error);
    }
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
        timeoutMs: 180_000,
        // The last chunk completes the upload, and TikTok then posts it.
        createsPost: index === chunks - 1
      });
      await assertOk(res, NAME);
    }

    // TikTok processes the upload on its side. Check briefly so a rejected
    // video is reported now instead of looking posted.
    const publishId = init.data.publish_id;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(5000);
      const status = await json<{data?: {status?: string; fail_reason?: string}}>(
        `${API}/post/publish/status/fetch/`,
        NAME,
        {method: 'POST', headers: auth, body: JSON.stringify({publish_id: publishId})}
      ).catch(() => null);
      const state = status?.data?.status;
      if (state === 'FAILED') {
        throw new ProviderError(`TikTok could not publish the video: ${status?.data?.fail_reason ?? 'unknown reason'}`, 'REJECTED', false);
      }
      if (state === 'PUBLISH_COMPLETE') break;
    }
    // Private posts never get a public link; TikTok shows them in the creator's profile.
    return {externalPostId: publishId};
  }
};
