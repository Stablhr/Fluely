import { httpClient } from "./httpClient";

/**
 * Resolves Open Graph metadata for a generic link.
 *
 * Provider links (YouTube, Vimeo, Drive, direct video) are rendered locally by
 * `parseEmbed` and never reach this endpoint; only addresses without a local
 * preview become link cards.
 */

export type LinkPreviewProvider =
  | "youtube"
  | "vimeo"
  | "google-drive"
  | "video"
  | "generic";

export type LinkPreviewAspectRatio = "16/9" | "9/16" | "4/3";

export interface LinkPreviewDto {
  provider: LinkPreviewProvider;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  aspectRatio: LinkPreviewAspectRatio;
}

export async function resolveLinkPreview(
  url: string,
  signal?: AbortSignal,
): Promise<LinkPreviewDto> {
  const { data } = await httpClient.get<LinkPreviewDto>("/embeds/resolve", {
    params: { url },
    signal,
  });
  return data;
}
