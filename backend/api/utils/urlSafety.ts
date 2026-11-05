import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {ApiError} from './error';
import {ErrorCodes} from '../constants/errorCodes';
import {MAX_PREVIEW_URL_LENGTH} from '../constants/linkPreview';

/**
 * URL and address checks for the link unfurl service.
 *
 * The server fetches a URL supplied by a signed-in person, so every hop has to
 * be treated as hostile. These helpers reject anything that is not a plain
 * public web address before a socket is opened:
 *
 * - only `http`/`https`, default ports only, no credentials;
 * - hostnames only (a literal IP is never a public page we want to fetch);
 * - DNS answers must all be public addresses, which also blocks the common
 *   "public hostname resolving to 127.0.0.1 or 169.254.169.254" trick.
 *
 * The resolved address is then connected to directly, with the original
 * hostname used for SNI and the `Host` header, so a second DNS answer cannot
 * swap in a private target between the check and the request.
 */

function invalidUrl(): ApiError {
  return new ApiError(
    400,
    ErrorCodes.VALIDATION_ERROR,
    'Enter a valid http or https link'
  );
}

export function previewUnavailable(): ApiError {
  return new ApiError(
    422,
    ErrorCodes.LINK_PREVIEW_UNAVAILABLE,
    'This link cannot be previewed'
  );
}

export function isIpLiteral(hostname: string): boolean {
  // WHATWG URLs keep the brackets on IPv6 literals; `isIP` expects them gone.
  const value =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  return isIP(value) !== 0;
}

/**
 * RFC 1918, loopback, link-local, carrier-grade NAT, benchmark, documentation,
 * multicast, and reserved IPv4 space.
 */
function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  // 224/4 multicast, 240/4 reserved, and the limited broadcast address.
  if (a >= 224) return false;

  return true;
}

/** Loopback, unspecified, IPv4-mapped, unique-local, link-local, multicast. */
function isPublicIpv6(address: string): boolean {
  const value = address.toLowerCase().split('%')[0];

  if (value === '::' || value === '::1') return false;

  // `::ffff:127.0.0.1` and `::ffff:7f00:1` both embed an IPv4 target.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return isPublicIpv4(mapped[1]);

  if (value.startsWith('::ffff:')) {
    const groups = value.slice(7).split(':');
    if (groups.length < 2) return false;
    const high = Number.parseInt(groups[groups.length - 2], 16);
    const low = Number.parseInt(groups[groups.length - 1], 16);
    if (!Number.isInteger(high) || !Number.isInteger(low)) return false;
    return isPublicIpv4(
      `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
    );
  }

  // Every other `::`-leading address is unspecified, loopback, or a deprecated
  // IPv4-compatible form; none are pages we should fetch.
  if (value.startsWith('::')) return false;

  if (value.startsWith('fc') || value.startsWith('fd')) return false; // fc00::/7
  if (value.startsWith('fe8') || value.startsWith('fe9')) return false; // fe80::/10
  if (value.startsWith('fea') || value.startsWith('feb')) return false;
  if (value.startsWith('ff')) return false; // ff00::/8
  if (value.startsWith('2001:db8') || value.startsWith('2001:0db8')) {
    return false; // documentation
  }
  // 6to4 and Teredo embed an IPv4 address, which could be private.
  if (value.startsWith('2002:')) return false;
  if (value.startsWith('2001:0:') || value.startsWith('2001:0000:')) return false;
  if (value.startsWith('64:ff9b:')) return false; // NAT64
  if (value.startsWith('100:')) return false; // discard-only

  return true;
}

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

/** Normalizes and validates a URL before it is fetched or hashed. */
export function normalizePreviewUrl(raw: string): URL {
  if (!raw || raw.length > MAX_PREVIEW_URL_LENGTH) throw invalidUrl();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidUrl();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalidUrl();
  if (url.username || url.password) throw invalidUrl();

  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== expectedPort) throw invalidUrl();

  const hostname = url.hostname.toLowerCase();
  if (isIpLiteral(hostname)) throw invalidUrl();
  if (!hostname.includes('.') || hostname === 'localhost') throw invalidUrl();

  // The fragment never changes what the server returns.
  url.hash = '';
  return url;
}

interface ResolvedAddress {
  address: string;
  family: number;
}

/**
 * Resolves a hostname and fails closed if *any* answer is non-public. Returning
 * one pinned public address is what lets the caller avoid a second lookup.
 */
export async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(hostname, {all: true, verbatim: true});
  } catch {
    throw previewUnavailable();
  }

  if (addresses.length === 0) throw previewUnavailable();
  if (addresses.some(item => !isPublicIp(item.address))) throw previewUnavailable();

  return addresses[0];
}
