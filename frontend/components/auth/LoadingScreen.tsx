'use client';

import {cn} from '@/lib/utils';
import {BRAND} from '@/lib/brand';
import {CURTAIN_FADE_OUT_MS} from '@/lib/auth/loadingCurtain';
import {BrandMark} from '@/components/brand/Logo';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight, while a route segment is resolving (app/loading.tsx), and on the
 * first paint of a full page load.
 *
 * The brand mark sits inside a thin orbiting arc with a soft cobalt halo
 * breathing behind it; its bars draw in from the baseline. Below it, the
 * product name and one line of status. Everything is on the theme's canvas
 * color so it matches the page that replaces it in light and dark.
 *
 * The overlay itself is opaque from the first frame (see the note below) and
 * fades out on close; `exiting` drives the fade and the provider owns the timer
 * that unmounts it once the fade has run.
 */

const COPY = {
  login: 'Signing you in',
  logout: 'Signing you out',
  /* Route/navigation curtain, shown from app/loading.tsx while a segment
     resolves and on the first paint of a full page load. */
  load: 'Loading your workspace'
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

const RING = 76;
const STROKE = 2;
const R = (RING - STROKE) / 2;

export default function LoadingScreen({mode = 'login', exiting = false}: LoadingScreenProps) {
  /* No fade-in on the overlay: this is also the Suspense fallback in
     app/loading.tsx, so its first paint is baked into the server HTML, and
     starting transparent would ship exactly the blank flash the curtain exists
     to cover. Only the content inside animates in. */
  const announced = !exiting;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={announced}
      aria-hidden={announced ? undefined : true}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background',
        'transition-[opacity,filter] ease-out',
        /* A fully transparent overlay still covers the page and eats clicks, so
           it stops taking pointer events the moment it starts fading. */
        exiting ? 'pointer-events-none opacity-0 blur-[2px]' : 'opacity-100'
      )}
      style={{transitionDuration: `${CURTAIN_FADE_OUT_MS}ms`}}
    >
      <div className="animate-rise relative flex items-center justify-center" style={{width: RING, height: RING}}>
        <span
          aria-hidden
          className="animate-halo absolute inset-0 rounded-full bg-primary/25 blur-2xl"
        />
        <svg
          aria-hidden
          width={RING}
          height={RING}
          viewBox={`0 0 ${RING} ${RING}`}
          className="animate-orbit absolute inset-0"
        >
          <defs>
            <linearGradient id="curtain-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke="url(#curtain-arc)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * R * 0.6} ${Math.PI * R * 2}`}
          />
        </svg>
        <BrandMark size={40} animated className="relative" />
      </div>

      <p
        className="animate-rise mt-6 text-[15px] font-semibold tracking-tight text-text-primary"
        style={{animationDelay: '80ms'}}
      >
        {BRAND.name}
      </p>
      <p
        className="animate-rise mt-1 flex items-center text-[13px] text-text-muted"
        style={{animationDelay: '140ms'}}
      >
        {COPY[mode]}
        <span aria-hidden className="loading-dots" />
      </p>
    </div>
  );
}
