/**
 * Shared shapes for the link unfurl endpoint.
 *
 * The list is deliberately closed: the API can only ever return one of these
 * providers, and the cache model enforces the same enum.
 */

export const LinkPreviewProviders = [
  'youtube',
  'vimeo',
  'google-drive',
  'video',
  'generic'
] as const;

export const MAX_PREVIEW_URL_LENGTH = 2048;

export type LinkPreviewProvider = (typeof LinkPreviewProviders)[number];

export const LinkPreviewAspectRatios = ['16/9', '9/16', '4/3'] as const;

export type LinkPreviewAspectRatio = (typeof LinkPreviewAspectRatios)[number];

export interface LinkPreviewResult {
  provider: LinkPreviewProvider;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  aspectRatio: LinkPreviewAspectRatio;
}
