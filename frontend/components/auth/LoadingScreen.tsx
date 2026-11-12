'use client';

import {cn} from '@/lib/utils';
import {CURTAIN_FADE_OUT_MS} from '@/lib/auth/loadingCurtain';
import {FluelyMark} from '@/components/brand/FluelyMark';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight, while a route segment is resolving (app/loading.tsx), and on the
 * first paint of a full page load.
 *
 * Deliberately quiet: the Fluely mark, a thin indeterminate bar, and one line
 * of status text, all on the theme's canvas color so it matches the page that
 * replaces it in both light and dark themes.
 *
 * The curtain fades out on close, so the hand-off to the next page is not a hard
 * cut. `exiting` drives the fade; the provider owns the timer that unmounts us
 * once it has run.
 */

const COPY = {
  login: 'Signing you in…',
  logout: 'Signing you out…',
  /* Route/navigation curtain, shown from app/loading.tsx while a segment
     resolves and on the first paint of a full page load. */
  load: 'Loading…'
} as const;

export type LoadingScreenMode = keyof typeof COPY;

type LoadingScreenProps = {
  mode?: LoadingScreenMode;
  /**
   * The page underneath is ready and the curtain is on its way out. The overlay
   * stays mounted and animates to `opacity-0`; the provider unmounts it once
   * CURTAIN_FADE_OUT_MS has elapsed.
   */
  exiting?: boolean;
};

export default function LoadingScreen({mode = 'login', exiting = false}: LoadingScreenProps) {
  /* No fade-in on mount: this is also the Suspense fallback in app/loading.tsx,
     so its first paint is baked into the server HTML, and starting transparent
     would ship exactly the blank flash the curtain exists to cover. */
  const announced = !exiting;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={announced}
      aria-hidden={announced ? undefined : true}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-5',
        'bg-background transition-opacity ease-out',
        /* A fully transparent overlay still covers the page and eats clicks, so
           it stops taking pointer events the moment it starts fading. */
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{transitionDuration: `${CURTAIN_FADE_OUT_MS}ms`}}
    >
      <FluelyMark size={40} />

      <div aria-hidden="true" className="h-1 w-40 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full w-1/3 rounded-full bg-primary animate-loading-bar" />
      </div>

      <p className="text-[13px] font-medium text-text-secondary">{COPY[mode]}</p>
    </div>
  );
}
