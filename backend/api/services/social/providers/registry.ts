import {env} from '../../../config/env';
import {PlatformMode, SchedulablePlatform, SchedulablePlatforms, PLATFORM_LABELS} from '../../../constants/social';
import {PostMedia} from '../../../models/SocialPost.model';
import {facebookProvider, instagramProvider} from './meta';
import {linkedinProvider} from './linkedin';
import {tiktokProvider} from './tiktok';
import {youtubeProvider} from './youtube';
import {SocialProvider} from './types';

const providers: Record<SchedulablePlatform, SocialProvider> = {
  instagram: instagramProvider,
  facebook: facebookProvider,
  tiktok: tiktokProvider,
  youtube: youtubeProvider,
  linkedin: linkedinProvider
};

export function getProvider(platform: SchedulablePlatform): SocialProvider {
  return providers[platform];
}

const MODE_ENV: Record<SchedulablePlatform, keyof typeof env> = {
  instagram: 'INSTAGRAM_MODE',
  facebook: 'FACEBOOK_MODE',
  tiktok: 'TIKTOK_MODE',
  youtube: 'YOUTUBE_MODE',
  linkedin: 'LINKEDIN_MODE'
};

/** `<PLATFORM>_MODE`; dry-run until a platform approves the app. */
export function platformMode(platform: SchedulablePlatform): PlatformMode {
  return (env[MODE_ENV[platform]] as PlatformMode | undefined) ?? 'dryrun';
}

/** What the frontend needs to render the Connect buttons. */
export function platformSummaries() {
  return SchedulablePlatforms.map(platform => ({
    platform,
    label: PLATFORM_LABELS[platform],
    mode: platformMode(platform),
    configured: providers[platform].isConfigured()
  }));
}

const CAPTION_LIMITS: Record<SchedulablePlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
  linkedin: 3000
};

/**
 * Each platform's content rules, checked when a post is scheduled and again
 * before it is published. They apply in dry-run mode too, so a simulated
 * success means the real post would have been accepted on content grounds.
 */
export function validateContent(
  platform: SchedulablePlatform,
  content: {text: string; hashtags: string[]; media: PostMedia[]}
): string[] {
  const errors: string[] = [];
  const label = PLATFORM_LABELS[platform];
  const images = content.media.filter(m => m.type === 'image');
  const videos = content.media.filter(m => m.type === 'video');

  if (content.text.length > CAPTION_LIMITS[platform]) {
    errors.push(`${label} captions can be at most ${CAPTION_LIMITS[platform]} characters`);
  }
  if (content.media.some(m => !m.storageUrl || !/^https?:\/\//.test(m.storageUrl))) {
    errors.push('Every media file has to finish uploading before the post can be scheduled');
  }

  switch (platform) {
    case 'instagram':
      if (content.media.length === 0) errors.push('Instagram posts need an image or a video');
      if (content.media.length > 10) errors.push('Instagram allows at most 10 media items per post');
      if (content.media.some(m => m.type === 'audio')) errors.push('Instagram does not accept audio files');
      if (content.hashtags.length > 30) errors.push('Instagram allows at most 30 hashtags');
      break;
    case 'facebook':
      if (!content.text.trim() && content.media.length === 0) errors.push('Facebook posts need text or media');
      if (videos.length > 1 || (videos.length === 1 && images.length > 0)) {
        errors.push('Facebook posts can have one video, or images, not both');
      }
      break;
    case 'tiktok':
      if (videos.length !== 1) errors.push('TikTok posts need exactly one video');
      break;
    case 'youtube':
      if (videos.length !== 1) errors.push('YouTube posts need exactly one video');
      break;
    case 'linkedin':
      if (!content.text.trim() && content.media.length === 0) errors.push('LinkedIn posts need text or an image');
      if (videos.length > 0 || content.media.some(m => m.type === 'audio')) {
        errors.push('LinkedIn posts support text and images for now');
      }
      if (images.length > 20) errors.push('LinkedIn allows at most 20 images per post');
      break;
  }
  return errors;
}
