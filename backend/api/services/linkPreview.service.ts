import http from 'node:http';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {createBrotliDecompress, createGunzip, createInflate} from 'node:zlib';
import type {IncomingMessage} from 'node:http';
import type {Readable} from 'node:stream';
import {linkPreviewRepository} from '../repositories/linkPreview.repository';
import type {LinkPreviewDocument} from '../models/LinkPreview.model';
import {
  normalizePreviewUrl,
  previewUnavailable,
  resolvePublicAddress
} from '../utils/urlSafety';
import {parseHtmlMetadata, safeImageUrl} from '../utils/htmlMetadata';
import {ApiError} from '../utils/error';
import {logger} from '../logging/logger';
import type {LinkPreviewResult} from '../constants/linkPreview';

/**
 * Link unfurls for the composer and post detail views.
 *
 * The server is fetching a URL chosen by a signed-in person, so the fetch path
 * is deliberately narrow: one pinned public address per hop, a short total
 * deadline, at most three redirects (each re-checked), a small body cap, and a
 * content-type allowlist. Nothing is cached unless every step succeeded.
 */

const TOTAL_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 256 * 1024;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USER_AGENT = 'FluelyLinkPreview/1.0 (+https://fluely.vercel.app)';

const HTML_ACCEPT = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1';
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];
const JSON_ACCEPT = 'application/json,text/json;q=0.9,*/*;q=0.1';
const JSON_TYPES = ['application/json', 'text/json'];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{6,20}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,80}$/;
const VIDEO_EXTENSION = /\.(?:mp4|webm|mov)$/i;

interface RawFetchResult {
  status: number;
  location?: string;
  contentType: string;
  body: string;
}

interface FetchResult extends RawFetchResult {
  /** Address after any redirects, used to resolve relative image sources. */
  url: URL;
}

type Target =
  | {provider: 'youtube'; id: string; portrait: boolean}
  | {provider: 'vimeo'; id: string; hash: string | null}
  | {provider: 'google-drive'; id: string}
  | {provider: 'video'}
  | {provider: 'generic'};

function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 3).trimEnd()}...`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function detectTarget(url: URL): Target {
  const host = url.hostname;
  const path = segments(url.pathname);

  if (hostMatches(host, 'youtu.be')) {
    const id = path[0] ?? '';
    if (YOUTUBE_ID.test(id)) return {provider: 'youtube', id, portrait: false};
  }

  if (hostMatches(host, 'youtube.com')) {
    if (path[0] === 'watch') {
      const id = url.searchParams.get('v') ?? '';
      if (YOUTUBE_ID.test(id)) return {provider: 'youtube', id, portrait: false};
    }
    if (path[0] === 'shorts') {
      const id = path[1] ?? '';
      if (YOUTUBE_ID.test(id)) return {provider: 'youtube', id, portrait: true};
    }
    if (path[0] === 'live' || path[0] === 'embed' || path[0] === 'v') {
      const id = path[1] ?? '';
      if (YOUTUBE_ID.test(id)) return {provider: 'youtube', id, portrait: false};
    }
  }

  if (hostMatches(host, 'vimeo.com')) {
    const id = path[0] === 'video' ? path[1] ?? '' : path[0] ?? '';
    const hash = path[0] === 'video' ? null : path[1] ?? null;
    if (VIMEO_ID.test(id) && (!hash || VIMEO_HASH.test(hash))) {
      return {provider: 'vimeo', id, hash};
    }
  }

  if (hostMatches(host, 'drive.google.com') || hostMatches(host, 'docs.google.com')) {
    let id = '';
    if (path[0] === 'file' && path[1] === 'd') id = path[2] ?? '';
    if (path[0] === 'file' && path[1] === 'u' && path[3] === 'd') id = path[4] ?? '';
    if (path[0] === 'open' || path[0] === 'uc') {
      id = url.searchParams.get('id') ?? '';
    }
    if (DRIVE_ID.test(id)) return {provider: 'google-drive', id};
  }

  if (VIDEO_EXTENSION.test(url.pathname)) return {provider: 'video'};

  return {provider: 'generic'};
}

function decodeBody(response: IncomingMessage): Readable | null {
  const encoding = String(response.headers['content-encoding'] ?? '')
    .toLowerCase()
    .trim();

  if (!encoding || encoding === 'identity') return response;
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.pipe(createGunzip());
  if (encoding === 'br') return response.pipe(createBrotliDecompress());
  if (encoding === 'deflate') return response.pipe(createInflate());
  return null;
}

/**
 * Resolves a hostname under the overall deadline, so a slow resolver cannot
 * outlive the request budget.
 */
function resolveWithinDeadline(hostname: string, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(previewUnavailable());

  return new Promise<{address: string; family: number}>(
    (resolve, reject) => {
      const timer = setTimeout(() => reject(previewUnavailable()), remaining);
      resolvePublicAddress(hostname).then(
        address => {
          clearTimeout(timer);
          resolve(address);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    }
  );
}

/**
 * One request to one already-validated URL. The connection goes to the exact
 * address that was just checked; the original hostname is still used for TLS
 * SNI and the `Host` header, so a second DNS answer cannot redirect the socket.
 */
function fetchOnce(
  url: URL,
  accept: string,
  acceptedTypes: string[],
  deadline: number
): Promise<RawFetchResult> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(previewUnavailable());
      return;
    }

    resolveWithinDeadline(url.hostname, deadline).then(pinned => {
      if (deadline - Date.now() <= 0) {
        reject(previewUnavailable());
        return;
      }

      const isHttps = url.protocol === 'https:';
      const port = url.port ? Number(url.port) : isHttps ? 443 : 80;

      const common = {
        hostname: pinned.address,
        family: pinned.family,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET' as const,
        agent: false,
        timeout: Math.max(1, deadline - Date.now()),
        headers: {
          Host: url.host,
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.8',
          'Accept-Encoding': 'identity',
          Connection: 'close'
        }
      };

      let requestSettled = false;
      let deadlineTimer: NodeJS.Timeout | null = null;

      const finish = (value: RawFetchResult) => {
        if (requestSettled) return;
        requestSettled = true;
        if (deadlineTimer) clearTimeout(deadlineTimer);
        resolve(value);
      };

      const abort = (error: ApiError) => {
        if (requestSettled) return;
        requestSettled = true;
        if (deadlineTimer) clearTimeout(deadlineTimer);
        reject(error);
      };

      const onResponse = (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers['content-type'] ?? '');
        const location =
          typeof response.headers.location === 'string'
            ? response.headers.location
            : undefined;

        if (status >= 300 && status < 400) {
          response.resume();
          finish({status, location, contentType, body: ''});
          return;
        }

        const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
        if (!acceptedTypes.includes(type)) {
          response.resume();
          abort(previewUnavailable());
          return;
        }

        const stream = decodeBody(response);
        if (!stream) {
          response.destroy();
          abort(previewUnavailable());
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;

        const body = () => Buffer.concat(chunks).toString('utf8');

        const stop = () => {
          stream.destroy();
          response.destroy();
        };

        const failBody = () => {
          abort(previewUnavailable());
          stop();
        };

        const finishBody = () => {
          const value = {status, location, contentType, body: body()};
          finish(value);
          stop();
        };

        stream.on('data', (chunk: Buffer) => {
          if (requestSettled) return;

          const available = MAX_BODY_BYTES - size;
          if (available <= 0) {
            finishBody();
            return;
          }

          // Metadata sits in `<head>`, so the first slice of a large page is
          // enough. Stop reading at the cap instead of failing the preview.
          const slice = chunk.length > available ? chunk.subarray(0, available) : chunk;
          chunks.push(slice);
          size += slice.length;

          if (chunk.length > available) finishBody();
        });
        stream.on('error', failBody);
        response.on('aborted', failBody);
        stream.on('end', () => {
          if (requestSettled) return;
          finish({status, location, contentType, body: body()});
        });
      };

      const request = isHttps
        ? https.request({...common, servername: url.hostname}, onResponse)
        : http.request(common, onResponse);

      // A total deadline, not just a per-socket idle timeout: a server that
      // drips bytes cannot keep the request (and the worker) alive.
      deadlineTimer = setTimeout(() => {
        request.destroy(previewUnavailable());
      }, Math.max(1, deadline - Date.now()));

      request.setTimeout(Math.max(1, deadline - Date.now()), () => {
        request.destroy(previewUnavailable());
      });
      request.on('error', error => {
        abort(error instanceof ApiError ? error : previewUnavailable());
      });
      request.end();
    }, reject);
  });
}

/**
 * Follows redirects manually so every hop is validated and re-resolved. The
 * initial URL has already passed `normalizePreviewUrl`; redirect targets go
 * through it again, and `fetchOnce` pins each target's DNS answer.
 */
async function fetchWithRedirects(
  url: URL,
  accept: string,
  acceptedTypes: string[],
  deadline: number
): Promise<FetchResult> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchOnce(current, accept, acceptedTypes, deadline);

    if (response.status >= 300 && response.status < 400) {
      if (hop === MAX_REDIRECTS || !response.location) throw previewUnavailable();

      let next: URL;
      try {
        next = normalizePreviewUrl(new URL(response.location, current).href);
      } catch {
        throw previewUnavailable();
      }
      current = next;
      continue;
    }

    if (response.status < 200 || response.status >= 300) throw previewUnavailable();
    return {...response, url: current};
  }

  throw previewUnavailable();
}

async function fetchOEmbed(endpoint: URL, deadline: number): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchWithRedirects(endpoint, JSON_ACCEPT, JSON_TYPES, deadline);
    const parsed: unknown = JSON.parse(response.body);
    return asRecord(parsed);
  } catch {
    // A provider can still be embedded without its title or poster.
    return null;
  }
}

async function resolveYouTube(
  id: string,
  portrait: boolean,
  sourceUrl: URL,
  deadline: number
): Promise<LinkPreviewResult> {
  const endpoint = new URL('https://www.youtube.com/oembed');
  endpoint.searchParams.set('url', sourceUrl.href);
  endpoint.searchParams.set('format', 'json');

  const data = await fetchOEmbed(endpoint, deadline);
  const thumbnail = safeImageUrl(asString(data?.thumbnail_url), sourceUrl)
    ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    provider: 'youtube',
    title: text(data?.title, 200),
    description: null,
    thumbnailUrl: thumbnail,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    aspectRatio: portrait ? '9/16' : '16/9'
  };
}

async function resolveVimeo(
  id: string,
  hash: string | null,
  sourceUrl: URL,
  deadline: number
): Promise<LinkPreviewResult> {
  const endpoint = new URL('https://vimeo.com/api/oembed.json');
  endpoint.searchParams.set('url', sourceUrl.href);

  const data = await fetchOEmbed(endpoint, deadline);
  const params = new URLSearchParams({dnt: '1'});
  if (hash) params.set('h', hash);

  return {
    provider: 'vimeo',
    title: text(data?.title, 200),
    description: null,
    thumbnailUrl: safeImageUrl(asString(data?.thumbnail_url), sourceUrl),
    embedUrl: `https://player.vimeo.com/video/${id}?${params.toString()}`,
    aspectRatio: '16/9'
  };
}

function resolveGoogleDrive(id: string): LinkPreviewResult {
  return {
    provider: 'google-drive',
    title: null,
    description: null,
    thumbnailUrl: null,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    aspectRatio: '16/9'
  };
}

function resolveDirectVideo(url: URL): LinkPreviewResult {
  return {
    provider: 'video',
    title: null,
    description: null,
    thumbnailUrl: null,
    embedUrl: url.href,
    aspectRatio: '16/9'
  };
}

async function resolveGeneric(url: URL, deadline: number): Promise<LinkPreviewResult> {
  const response = await fetchWithRedirects(url, HTML_ACCEPT, HTML_TYPES, deadline);
  const metadata = parseHtmlMetadata(response.body);

  return {
    provider: 'generic',
    title: metadata.title ?? response.url.hostname,
    description: metadata.description,
    thumbnailUrl: safeImageUrl(metadata.imageUrl, response.url),
    embedUrl: null,
    aspectRatio: '16/9'
  };
}

async function resolveUncached(url: URL, deadline: number): Promise<LinkPreviewResult> {
  const target = detectTarget(url);

  switch (target.provider) {
    case 'youtube':
      return resolveYouTube(target.id, target.portrait, url, deadline);
    case 'vimeo':
      return resolveVimeo(target.id, target.hash, url, deadline);
    case 'google-drive':
      return resolveGoogleDrive(target.id);
    case 'video':
      return resolveDirectVideo(url);
    case 'generic':
      return resolveGeneric(url, deadline);
  }
}

function hashUrl(href: string): string {
  return createHash('sha256').update(href).digest('hex');
}

function toResult(document: LinkPreviewDocument): LinkPreviewResult {
  return {
    provider: document.provider,
    title: document.title,
    description: document.description,
    thumbnailUrl: document.thumbnailUrl,
    embedUrl: document.embedUrl,
    aspectRatio: document.aspectRatio
  };
}

export const linkPreviewService = {
  async resolve(rawUrl: string): Promise<LinkPreviewResult> {
    const url = normalizePreviewUrl(rawUrl);
    const urlHash = hashUrl(url.href);

    const cached = await linkPreviewRepository.findUsable(urlHash);
    if (cached) return toResult(cached);

    let result: LinkPreviewResult;
    try {
      result = await resolveUncached(url, Date.now() + TOTAL_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.warn({err: error, host: url.hostname}, 'Link preview lookup failed');
      throw previewUnavailable();
    }

    try {
      await linkPreviewRepository.upsert({
        urlHash,
        url: url.href,
        ...result,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_TTL_MS)
      });
    } catch (error) {
      // A cache write failure must not cost the caller their preview.
      logger.warn({err: error, host: url.hostname}, 'Link preview cache write failed');
    }

    return result;
  }
};
