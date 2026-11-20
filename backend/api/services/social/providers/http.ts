import {ProviderError} from './types';

/**
 * Small fetch wrapper shared by the platform adapters. Maps HTTP failures to
 * `ProviderError` so the publisher can decide between retry and give-up
 * without knowing each platform's error format.
 */

const TIMEOUT_MS = 30_000;

function describe(body: unknown): string {
  if (!body || typeof body !== 'object') return typeof body === 'string' ? body.slice(0, 300) : '';
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const inner = error as Record<string, unknown>;
    const message = String(inner.message ?? inner.error_user_msg ?? inner.code ?? JSON.stringify(inner));
    const code = typeof inner.code === 'string' && inner.code !== 'ok' && !message.includes(inner.code) ? ` [${inner.code}]` : '';
    return `${message}${code}`.slice(0, 300);
  }
  return String(
    record.message ?? record.error_description ?? record.error ?? JSON.stringify(record)
  ).slice(0, 300);
}

export async function http(
  url: string,
  init: RequestInit & {timeoutMs?: number} = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, {...init, signal: controller.signal});
  } catch (error) {
    throw new ProviderError(
      `Could not reach the platform: ${(error as Error).message}`,
      'NETWORK_ERROR',
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Throws a classified `ProviderError` for a non-2xx response. */
export async function assertOk(res: Response, platform: string): Promise<void> {
  if (res.ok) return;
  let body: unknown = null;
  try {
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } catch {
    // ignore
  }
  const message = `${platform}: ${describe(body) || res.statusText} (HTTP ${res.status})`;
  if (res.status === 401) throw new ProviderError(message, 'TOKEN_INVALID', false, true);
  if (res.status === 403) throw new ProviderError(message, 'FORBIDDEN', false);
  if (res.status === 429) throw new ProviderError(message, 'RATE_LIMITED', true);
  if (res.status >= 500) throw new ProviderError(message, 'PLATFORM_UNAVAILABLE', true);
  throw new ProviderError(message, 'REJECTED', false);
}

export async function json<T = Record<string, unknown>>(
  url: string,
  platform: string,
  init: RequestInit & {timeoutMs?: number} = {}
): Promise<T> {
  const res = await http(url, init);
  await assertOk(res, platform);
  return (await res.json()) as T;
}

export function form(values: Record<string, string | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, value);
  }
  return params;
}

/** Downloads a media file (from Cloudinary) for platforms that need the bytes. */
export async function downloadMedia(
  url: string,
  platform: string
): Promise<{bytes: Uint8Array<ArrayBuffer>; type: string}> {
  const res = await http(url, {timeoutMs: 120_000});
  if (!res.ok) {
    throw new ProviderError(
      `${platform}: could not download the media file (HTTP ${res.status})`,
      'MEDIA_UNAVAILABLE',
      res.status >= 500
    );
  }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    type: res.headers.get('content-type') ?? 'application/octet-stream'
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
