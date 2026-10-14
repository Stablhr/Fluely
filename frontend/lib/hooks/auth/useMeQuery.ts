import {useQuery} from '@tanstack/react-query';
import {getMe} from '@/lib/api/authApi';
import type {NormalizedApiError} from '@/lib/api/types';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * Resolves the signed-in account, retrying a transient failure before giving up.
 *
 * The app gate redirects to sign-in the moment this query errors, so a single
 * cold start or dropped connection on `/auth/me` would look like being signed
 * out. A definite 401/403 is different: the http client has already tried to
 * refresh the session by then, so retrying only delays the sign-in redirect.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as Partial<NormalizedApiError> | null)?.status;
  if (status === 401 || status === 403) return false;
  return failureCount < 2;
}

export function useMeQuery() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    retry: shouldRetry,
    refetchOnWindowFocus: false,
    staleTime: 30_000
  });
}
