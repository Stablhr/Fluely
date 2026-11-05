import { toHref, tokenizeText } from './linkify'

/**
 * Recognizes links that can be shown as an inline player or document preview.
 *
 * Descriptions and captions are stored as plain strings, so an embed is derived
 * from the stored text at render time: no schema change and no migration.
 *
 * Every embed URL is rebuilt from a validated identifier. The address the
 * person pasted is kept only as `sourceUrl` for the fallback link, so raw input
 * never reaches an `iframe` source.
 */

export type EmbedProvider = 'youtube' | 'vimeo' | 'google-drive' | 'video'

export type EmbedAspectRatio = '16/9' | '9/16' | '4/3'

export interface EmbedDescriptor {
  provider: EmbedProvider
  /** The address as it appeared in the text, kept for the fallback link. */
  sourceUrl: string
  /** Built from a validated id, never taken from the raw input. */
  embedUrl: string
  thumbnailUrl?: string
  aspectRatio: EmbedAspectRatio
  kind: 'video' | 'document'
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d{5,12}$/
const VIMEO_HASH = /^[A-Za-z0-9]{6,20}$/
const DRIVE_ID = /^[A-Za-z0-9_-]{10,80}$/
const VIDEO_EXTENSION = /\.(?:mp4|webm|mov)$/i

/**
 * Exact host or a dot-boundary subdomain. This is what keeps
 * `youtube.com.evil.tld` from being treated as YouTube.
 */
function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase()
  return host === domain || host.endsWith(`.${domain}`)
}

function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function youtube(id: string, sourceUrl: string, portrait = false): EmbedDescriptor | null {
  if (!YOUTUBE_ID.test(id)) return null
  return {
    provider: 'youtube',
    sourceUrl,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    aspectRatio: portrait ? '9/16' : '16/9',
    kind: 'video',
  }
}

function vimeo(id: string, sourceUrl: string, hash: string | null): EmbedDescriptor | null {
  if (!VIMEO_ID.test(id)) return null
  if (hash && !VIMEO_HASH.test(hash)) return null

  const params = new URLSearchParams({ dnt: '1' })
  if (hash) params.set('h', hash)

  return {
    provider: 'vimeo',
    sourceUrl,
    embedUrl: `https://player.vimeo.com/video/${id}?${params.toString()}`,
    aspectRatio: '16/9',
    kind: 'video',
  }
}

function googleDrive(id: string, sourceUrl: string): EmbedDescriptor | null {
  if (!DRIVE_ID.test(id)) return null
  return {
    provider: 'google-drive',
    sourceUrl,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    aspectRatio: '16/9',
    kind: 'document',
  }
}

function parseGoogleDrive(url: URL, path: string[], sourceUrl: string): EmbedDescriptor | null {
  if (path[0] === 'file') {
    // /file/d/<id>/view and /file/u/0/d/<id>/view
    if (path[1] === 'd') return googleDrive(path[2] ?? '', sourceUrl)
    if (path[1] === 'u' && path[3] === 'd') return googleDrive(path[4] ?? '', sourceUrl)
    return null
  }
  if (path[0] === 'open') {
    return googleDrive(url.searchParams.get('id') ?? '', sourceUrl)
  }
  // Folders and everything else stay a plain link.
  return null
}

/**
 * Returns an embed descriptor when the address is a supported provider,
 * otherwise `null`. Only `http` and `https` addresses are considered.
 */
export function parseEmbed(raw: string): EmbedDescriptor | null {
  const href = toHref(raw.trim())
  if (!href) return null

  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const host = url.hostname
  const path = segments(url.pathname)

  if (hostMatches(host, 'youtu.be')) {
    return youtube(path[0] ?? '', href)
  }

  if (hostMatches(host, 'youtube.com')) {
    if (path[0] === 'watch') return youtube(url.searchParams.get('v') ?? '', href)
    if (path[0] === 'shorts') return youtube(path[1] ?? '', href, true)
    if (path[0] === 'live' || path[0] === 'embed' || path[0] === 'v') {
      return youtube(path[1] ?? '', href)
    }
    // Playlists without a video id and channel pages stay plain links.
    return null
  }

  if (hostMatches(host, 'vimeo.com')) {
    if (path[0] === 'video') return vimeo(path[1] ?? '', href, null)
    return vimeo(path[0] ?? '', href, path[1] ?? null)
  }

  if (hostMatches(host, 'drive.google.com') || hostMatches(host, 'docs.google.com')) {
    return parseGoogleDrive(url, path, href)
  }

  if (VIDEO_EXTENSION.test(url.pathname)) {
    return {
      provider: 'video',
      sourceUrl: href,
      embedUrl: href,
      aspectRatio: '16/9',
      kind: 'video',
    }
  }

  return null
}

/** A line that is exactly one link, as it appeared in the text. */
export interface LinkDescriptor {
  /** The address as the person typed it, kept for display. */
  value: string
  /** Normalized `http(s)` address, used for the request and the anchor. */
  href: string
}

/**
 * What a line can become when it sits alone: a provider embed, or a generic
 * link card resolved by the backend.
 */
export type LinePreview =
  | { kind: 'embed'; descriptor: EmbedDescriptor }
  | { kind: 'link'; link: LinkDescriptor }

/**
 * Returns a descriptor only when the whole trimmed line is exactly one link.
 *
 * This is the rule the renderer and the composer both use: a link becomes a
 * preview only on its own line, never mid-sentence.
 */
export function parseLinkLine(line: string): LinkDescriptor | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const tokens = tokenizeText(trimmed)
  const [token] = tokens
  if (tokens.length !== 1 || token?.type !== 'link') return null
  return { value: token.value, href: token.href }
}

/**
 * Classifies a standalone link line. Providers we can build locally stay an
 * `embed` (no network call); everything else becomes a `link` for the card.
 */
export function parsePreviewLine(line: string): LinePreview | null {
  const link = parseLinkLine(line)
  if (!link) return null

  const descriptor = parseEmbed(link.href)
  return descriptor ? { kind: 'embed', descriptor } : { kind: 'link', link }
}

/** A provider embed only, for callers that cannot show generic cards. */
export function parseEmbedLine(line: string): EmbedDescriptor | null {
  const preview = parsePreviewLine(line)
  return preview?.kind === 'embed' ? preview.descriptor : null
}

/** The first previewable URL in a multi-line block of text, if any. */
export function findFirstPreview(text: string): LinePreview | null {
  for (const line of text.split('\n')) {
    const preview = parsePreviewLine(line)
    if (preview) return preview
  }
  return null
}

/** The first provider embed in a multi-line block of text, if any. */
export function findFirstEmbed(text: string): EmbedDescriptor | null {
  for (const line of text.split('\n')) {
    const descriptor = parseEmbedLine(line)
    if (descriptor) return descriptor
  }
  return null
}
