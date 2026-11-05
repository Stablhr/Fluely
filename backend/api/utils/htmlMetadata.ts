import {isIpLiteral} from './urlSafety';

/**
 * Minimal, dependency-free reader for the metadata a link card needs.
 *
 * The HTML comes from an untrusted host, so this never executes anything and
 * never returns markup: it only pulls out text values, decodes entities, and
 * caps their length. Images go through `safeImageUrl`, which keeps the browser
 * from being pointed at a private address.
 */

export interface HtmlMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '...',
  lt: '<',
  mdash: '-',
  ndash: '-',
  nbsp: ' ',
  quot: '"',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"'
};

function decodeCodePoint(raw: string, radix: number): string | null {
  const code = Number.parseInt(raw, radix);
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
  // Surrogate halves cannot be produced by `fromCodePoint`.
  if (code >= 0xd800 && code <= 0xdfff) return null;
  try {
    return String.fromCodePoint(code);
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,31});/gi,
    (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        return decodeCodePoint(entity.slice(2), 16) ?? match;
      }
      if (entity.startsWith('#')) {
        return decodeCodePoint(entity.slice(1), 10) ?? match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    }
  );
}

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const collapsed = decodeEntities(value).replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 3).trimEnd()}...`;
}

interface AttributeMap {
  byName: Map<string, string>;
  byProperty: Map<string, string>;
  links: Map<string, string>;
}

const ATTRIBUTE_PATTERN =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  let match: RegExpExecArray | null;

  while ((match = ATTRIBUTE_PATTERN.exec(tag)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (!attributes.has(name)) attributes.set(name, decodeEntities(value));
  }

  return attributes;
}

function collectAttributes(html: string): AttributeMap {
  const result: AttributeMap = {
    byName: new Map(),
    byProperty: new Map(),
    links: new Map()
  };

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const content = attributes.get('content');
    if (!content) continue;

    const property = attributes.get('property')?.toLowerCase();
    if (property && !result.byProperty.has(property)) {
      result.byProperty.set(property, content);
    }

    const name = attributes.get('name')?.toLowerCase();
    if (name && !result.byName.has(name)) {
      result.byName.set(name, content);
    }
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const rel = attributes.get('rel')?.toLowerCase();
    const href = attributes.get('href');
    if (rel && href && !result.links.has(rel)) {
      result.links.set(rel, href);
    }
  }

  return result;
}

function documentTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1] : null;
}

function firstValue(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

export function parseHtmlMetadata(html: string): HtmlMetadata {
  // Script and style bodies can contain tag-shaped text that would confuse the
  // simple scans below.
  const cleaned = html.replace(
    /<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
    ' '
  );
  const attributes = collectAttributes(cleaned);

  const title = cleanText(
    firstValue(
      attributes.byProperty.get('og:title'),
      attributes.byName.get('twitter:title'),
      attributes.byName.get('title'),
      documentTitle(cleaned)
    ),
    200
  );

  const description = cleanText(
    firstValue(
      attributes.byProperty.get('og:description'),
      attributes.byName.get('twitter:description'),
      attributes.byName.get('description')
    ),
    300
  );

  const imageUrl = firstValue(
    attributes.byProperty.get('og:image:secure_url'),
    attributes.byProperty.get('og:image'),
    attributes.byProperty.get('og:image:url'),
    attributes.byName.get('twitter:image'),
    attributes.byName.get('twitter:image:src'),
    attributes.links.get('image_src')
  );

  return {title, description, imageUrl};
}

/**
 * Returns an absolute http(s) image address, or `null`.
 *
 * Relative sources are resolved against the page that declared them. Addresses
 * that could reach the viewer's own network are rejected, as are `data:` and
 * other schemes.
 */
export function safeImageUrl(raw: string | null | undefined, pageUrl: URL): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.trim(), pageUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase();
  if (isIpLiteral(hostname)) return null;
  if (!hostname.includes('.')) return null;
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa')
  ) {
    return null;
  }

  url.hash = '';
  return url.href;
}
