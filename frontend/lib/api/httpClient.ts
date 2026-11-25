import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import type {ApiErrorPayload, NormalizedApiError} from './types';

/**
 * The API base URL.
 *
 * Defaults to the same-origin `/api` proxy (see next.config.ts) so the session
 * cookies stay first-party. Local development sets NEXT_PUBLIC_API_URL to the
 * absolute backend URL and calls it directly instead.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const resolvedBaseUrl = API_BASE_URL;

let refreshPromise: Promise<void> | null = null;

// One in-flight/cached token promise: every GET /auth/csrf rotates the cookie,
// so concurrent mutations must share a single fetch.
let csrfPromise: Promise<string> | null = null;
let httpClientRef: ReturnType<typeof axios.create>;

const refreshClient = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function ensureCsrfToken(): Promise<string> {
  csrfPromise ??= httpClientRef
    .get<{csrfToken: string}>('/auth/csrf')
    .then(res => res.data.csrfToken)
    .catch(error => {
      csrfPromise = null;
      throw error;
    });
  return csrfPromise;
}

/**
 * Forget the cached token, but only if it is the one the failed request sent;
 * otherwise a parallel request already replaced it and dropping the new one
 * would rotate the cookie again.
 */
async function dropCsrfToken(error: AxiosError) {
  const sent = error.config?.headers?.['x-csrf-token'];
  const cached = csrfPromise;
  if (!cached) return;
  const current = await cached.catch(() => null);
  if (csrfPromise === cached && (!sent || current === sent)) csrfPromise = null;
}

function attachCsrfInterceptor(client: ReturnType<typeof axios.create>) {
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const method = (config.method ?? 'get').toUpperCase();
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        try {
          const token = await ensureCsrfToken();
          if (token) {
            config.headers.set('x-csrf-token', token);
          }
        } catch {
          // If the CSRF token cannot be fetched, let the request proceed;
          // the server will reject it with 403 if the token is required.
        }
      }
      return config;
    }
  );
}

function normalizeAxiosError(error: unknown): NormalizedApiError {
  const fallback: NormalizedApiError = {
    status: null,
    code: 'NETWORK_ERROR',
    message: 'Network error',
    details: undefined
  };

  if (!axios.isAxiosError(error)) return fallback;

  const axiosError = error as AxiosError<ApiErrorPayload>;
  const status = axiosError.response?.status ?? null;

  const payload = axiosError.response?.data;
  if (payload && typeof payload === 'object') {
    const message = payload.message ?? axiosError.message ?? fallback.message;
    const code = payload.code ?? fallback.code;
    return {
      status,
      code,
      message,
      details: payload.details
    };
  }

  return {
    ...fallback,
    status,
    message: axiosError.message || fallback.message
  };
}

function isCsrfError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return (
    axiosError.response?.status === 403 &&
    axiosError.response.data?.code === 'CSRF_TOKEN_INVALID'
  );
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      await refreshClient.post('/auth/refresh', {});
    } catch (error) {
      // A cached CSRF token can outlive the cookie it was issued for (the
      // cookie is cleared when a refresh fails, and a server restart drops it).
      // That surfaces as a 403 on the token-guarded refresh call and is the one
      // refresh failure worth retrying: drop the cached value so the request
      // interceptor fetches a fresh one, and try once more. Anything else means
      // the refresh token itself is gone, so let it reject.
      if (!isCsrfError(error)) throw error;
      await dropCsrfToken(error as AxiosError);
      await refreshClient.post('/auth/refresh', {});
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export const httpClient = (() => {
  const client = axios.create({
    baseURL: resolvedBaseUrl,
    timeout: 20000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  httpClientRef = client;
  attachCsrfInterceptor(client);

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(normalizeAxiosError(error));
      }

      const axiosError: AxiosError<ApiErrorPayload> = error;
      const originalConfig = axiosError.config as
        | (AxiosRequestConfig & {_retry?: boolean; _csrfRetry?: boolean})
        | undefined;
      const status = axiosError.response?.status;

      const url = originalConfig?.url ?? '';
      const isRefreshOrLoginEndpoint =
        url === '/auth/refresh' ||
        url === '/auth/login' ||
        url === '/auth/logout' ||
        url === '/auth/register' ||
        url === '/auth/verify' ||
        url === '/auth/resend-verification';

      // A stale CSRF token (cookie rotated or cleared): refetch it and retry once.
      if (isCsrfError(axiosError) && originalConfig && !originalConfig._csrfRetry) {
        originalConfig._csrfRetry = true;
        await dropCsrfToken(axiosError);
        return client(originalConfig);
      }

      if (
        status === 401 &&
        originalConfig &&
        !originalConfig._retry &&
        !isRefreshOrLoginEndpoint
      ) {
        originalConfig._retry = true;
        try {
          await refreshAccessToken();
          return client(originalConfig);
        } catch (refreshError) {
          // Another tab refreshed with the same token first and its new cookies
          // are already in the jar, so the original request can simply go again.
          if (
            axios.isAxiosError(refreshError) &&
            (refreshError.response?.data as ApiErrorPayload | undefined)?.message === 'Refresh token already used'
          ) {
            return client(originalConfig);
          }
          // Reject here so your SignInPage catch runs
          return Promise.reject(normalizeAxiosError(refreshError));
        }
      }

      return Promise.reject(normalizeAxiosError(axiosError));
    }
  );

  return client;
})();

attachCsrfInterceptor(refreshClient);
