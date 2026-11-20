import {env} from '../../../config/env';
import {assertOk, downloadMedia, form, http, json} from './http';
import {ProviderError, PublishInput, SocialProvider, TokenSet} from './types';

/**
 * YouTube Data API v3. Uploads with the resumable protocol at the scheduled
 * time. Until Google audits the project, uploads from the API stay private
 * whatever visibility is asked for.
 */

const NAME = 'YouTube';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

type GoogleToken = {access_token: string; expires_in: number; refresh_token?: string; scope?: string};

function toTokenSet(res: GoogleToken, previousRefresh?: string): TokenSet {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? previousRefresh ?? null,
    expiresAt: new Date(Date.now() + res.expires_in * 1000),
    scopes: (res.scope ?? '').split(' ').filter(Boolean)
  };
}

function exchange(values: Record<string, string | undefined>) {
  return json<GoogleToken>('https://oauth2.googleapis.com/token', NAME, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...values})
  });
}

export const youtubeProvider: SocialProvider = {
  platform: 'youtube',

  isConfigured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),

  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const set = toTokenSet(
      await exchange({code, redirect_uri: redirectUri, grant_type: 'authorization_code'})
    );
    const channels = await json<{
      items?: {id: string; snippet?: {title?: string; customUrl?: string; thumbnails?: {default?: {url?: string}}}}[];
    }>('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', NAME, {
      headers: {Authorization: `Bearer ${set.accessToken}`}
    });
    const items = channels.items ?? [];
    if (items.length === 0) {
      throw new ProviderError('YouTube: this Google account has no YouTube channel', 'NO_CHANNEL', false);
    }
    return items.map(channel => ({
      platformAccountId: channel.id,
      accountType: 'channel',
      accountName: channel.snippet?.title ?? 'YouTube channel',
      accountUsername: channel.snippet?.customUrl,
      profileImageUrl: channel.snippet?.thumbnails?.default?.url,
      token: set
    }));
  },

  async refresh(refreshToken) {
    return toTokenSet(await exchange({grant_type: 'refresh_token', refresh_token: refreshToken}), refreshToken);
  },

  async publish({account, content}: PublishInput) {
    const video = content.media.find(m => m.type === 'video');
    if (!video?.storageUrl) {
      throw new ProviderError('YouTube posts need a video', 'MEDIA_REQUIRED', false);
    }
    const {bytes, type} = await downloadMedia(video.storageUrl, NAME);
    const privacyStatus =
      content.visibility === 'private' ? 'private' : content.visibility === 'unlisted' ? 'unlisted' : 'public';

    const start = await http(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(bytes.length),
          'X-Upload-Content-Type': type.startsWith('video/') ? type : 'video/*'
        },
        body: JSON.stringify({
          snippet: {
            title: (content.title || content.text.split('\n')[0] || 'Untitled').slice(0, 100),
            description: content.text.slice(0, 5000),
            tags: content.hashtags.slice(0, 15)
          },
          status: {privacyStatus, selfDeclaredMadeForKids: false}
        })
      }
    );
    await assertOk(start, NAME);
    const location = start.headers.get('location');
    if (!location) throw new ProviderError('YouTube did not return an upload address', 'PLATFORM_UNAVAILABLE', true);

    const upload = await http(location, {
      method: 'PUT',
      headers: {Authorization: `Bearer ${account.accessToken}`, 'Content-Type': type},
      body: bytes,
      timeoutMs: 300_000
    });
    await assertOk(upload, NAME);
    const result = (await upload.json()) as {id: string};
    return {externalPostId: result.id, publishedUrl: `https://www.youtube.com/watch?v=${result.id}`};
  }
};
