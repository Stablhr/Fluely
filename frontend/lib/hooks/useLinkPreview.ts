import { useQuery } from '@tanstack/react-query'
import { resolveLinkPreview } from '@/lib/api/embedsApi'

/**
 * Server state for one link card.
 *
 * A preview changes slowly — titles and images rarely move — so the result is
 * kept for nearly a week and is never refetched merely because the window
 * regained focus. Mounting a card with the same address in another list reuses
 * the cached entry instead of repeating the unfurl.
 */

const SIX_DAYS = 6 * 24 * 60 * 60 * 1000
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export function linkPreviewQueryKey(href: string) {
  return ['link-preview', href] as const
}

export function useLinkPreview(href: string) {
  return useQuery({
    queryKey: linkPreviewQueryKey(href),
    queryFn: ({ signal }) => resolveLinkPreview(href, signal),
    enabled: Boolean(href),
    staleTime: SIX_DAYS,
    gcTime: SEVEN_DAYS,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
