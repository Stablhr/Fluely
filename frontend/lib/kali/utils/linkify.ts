/**
 * Splits plain text into text and link tokens for rendering.
 *
 * Descriptions, comments and captions are stored as plain strings, so link
 * detection happens at render time: no schema change, no migration, and older
 * records pick up links without being rewritten.
 *
 * Only explicit `http(s)://` URLs and `www.` prefixes are linked. Bare domains
 * ("example.com") stay text — treating every dotted token as a link produces
 * far too many false positives in ordinary writing.
 */

export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }

/** Longer than any address we want to render as a single clickable run. */
const MAX_URL_LENGTH = 2048

/** Punctuation people commonly put *after* a URL in a sentence. */
const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', "'", '"', '<', '>'])

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi

function countCharacter(value: string, character: string): number {
  let count = 0
  for (const current of value) {
    if (current === character) count += 1
  }
  return count
}

/**
 * Drops punctuation that belongs to the sentence rather than the address.
 *
 * Closing brackets are only removed when they are unbalanced, so a URL that
 * legitimately contains them — `…/Foo_(bar)` — survives intact.
 */
function trimTrailingPunctuation(raw: string): string {
  let url = raw
  for (;;) {
    const last = url[url.length - 1]
    if (!last) return url
    if (TRAILING_PUNCTUATION.has(last)) {
      url = url.slice(0, -1)
      continue
    }
    if (last === ')' && countCharacter(url, '(') < countCharacter(url, ')')) {
      url = url.slice(0, -1)
      continue
    }
    if (last === ']' && countCharacter(url, '[') < countCharacter(url, ']')) {
      url = url.slice(0, -1)
      continue
    }
    if (last === '}' && countCharacter(url, '{') < countCharacter(url, '}')) {
      url = url.slice(0, -1)
      continue
    }
    return url
  }
}

/**
 * Normalizes a matched URL into an `href`, or `null` when it is not a usable
 * web address. A `www.` address has no scheme in the text, so `https://` is
 * supplied before parsing.
 */
export function toHref(raw: string): string | null {
  if (!raw || raw.length > MAX_URL_LENGTH) return null
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // `new URL` accepts hosts like `localhost`; a public link has a dot.
  if (!url.hostname.includes('.')) return null

  return url.href
}

export function tokenizeText(input: string): TextToken[] {
  if (!input) return []

  const tokens: TextToken[] = []
  const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input)) !== null) {
    const start = match.index
    // Skip addresses embedded in an email (`someone@www.example.com`).
    if (start > 0 && input[start - 1] === '@') continue

    const value = trimTrailingPunctuation(match[0])
    const href = toHref(value)
    if (!href) continue

    if (start > lastIndex) {
      tokens.push({ type: 'text', value: input.slice(lastIndex, start) })
    }
    tokens.push({ type: 'link', value, href })

    // Resume after the link itself, so any trimmed punctuation is emitted as
    // the start of the next text token rather than disappearing.
    lastIndex = start + value.length
    pattern.lastIndex = lastIndex
  }

  if (lastIndex < input.length) {
    tokens.push({ type: 'text', value: input.slice(lastIndex) })
  }

  return tokens
}
