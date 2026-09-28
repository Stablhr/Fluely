import LoadingScreen from '@/components/auth/LoadingScreen';

/**
 * Suspense fallback for the root segment.
 *
 * This used to render a bare `<p>Loading...</p>`, which is what produced the
 * unstyled text sitting in the top-left corner of an otherwise empty page on
 * every client-side navigation outside the (app) group — nothing centred it,
 * nothing covered the outgoing page, and no brand on screen at all.
 *
 * It now renders the same loading curtain the auth flows use, so route
 * transitions and the streamed first paint of a full page load show the mascot
 * and progress bar. Nesting inside (app) matters: (app)/loading.tsx is closer to
 * those routes and keeps its own DashboardSkeleton, so navigating around the
 * planner does not blank the screen to a full-screen curtain.
 *
 * LoadingScreen is a client component, so this file stays a server component and
 * the overlay is part of the HTML the server sends — the curtain is already on
 * screen before the bundle parses.
 */
export default function Loading() {
  return <LoadingScreen mode="load" />;
}
