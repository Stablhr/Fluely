'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import {LOADING_FRAMES} from '@/lib/loadingFrames';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight, and on the first paint of any full page load. The mascot run-cycle is
 * four hand-drawn frames swapped on a timer (option A from the brief: no
 * framer-motion in this project), and the progress bar underneath is a separate
 * CSS animation so it can run at its own rhythm instead of being locked to the
 * frame cycle.
 *
 * Colors come from the brand tokens in app/kali.css — Ivory background, Drab
 * Dark Brown text, Poppins for the heading.
 */

/* ~5.7fps reads as a run cycle; slower than this and it looks like a slideshow.
   The curtain itself is held on screen for a minimum of MIN_CURTAIN_MS
   (lib/auth/loadingCurtain.ts) so a fast response cannot reduce the whole thing
   to a single frame. */
const FRAME_INTERVAL_MS = 175;

const COPY = {
  login: 'Signing you in...',
  logout: 'Signing you out...',
  /* Boot curtain, shown on the first paint of a full page load. */
  load: 'Getting things ready...',
} as const;

export type LoadingScreenMode = keyof typeof COPY;

/**
 * Pull the four frames into the browser cache, resolving once they have decoded.
 *
 * Called from the provider on app mount rather than from the component below:
 * starting the download when the curtain opens is too late, because frame one
 * would still be in flight and the mascot would pop in a beat after the
 * overlay. The frames render with `unoptimized`, so the URL cached here is the
 * same one that ends up in the img src.
 *
 * The returned promise is what lets the boot curtain wait for a real mascot
 * instead of lifting on an empty box. It never rejects: a frame that fails to
 * load must not wedge the page behind a full-screen overlay.
 */
export function preloadLoadingFrames(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  return Promise.all(
    LOADING_FRAMES.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        })
    )
  ).then(() => undefined);
}

type LoadingScreenProps = {
  mode?: LoadingScreenMode;
};

export default function LoadingScreen({mode = 'login'}: LoadingScreenProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % LOADING_FRAMES.length);
    }, FRAME_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-brand-ivory/95 backdrop-blur-[2px]"
    >
      {/* Fixed box: the four frames differ slightly in size and whitespace, so a
          fluid container would make the whole stack twitch on every swap. */}
      <div className="flex h-48 w-72 items-center justify-center">
        <Image
          src={LOADING_FRAMES[frame]}
          alt=""
          width={288}
          height={188}
          unoptimized
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>

      <div
        aria-hidden="true"
        className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-alt"
      >
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-brand-blue to-transparent animate-loading-bar" />
      </div>

      {/* The visible label is the accessible text. An extra sr-only copy used to
          sit here, but with role="status" the container announced both, so
          screen readers heard the sentence twice. */}
      <p className="font-heading text-[15px] font-semibold text-brand-ink">
        {COPY[mode]}
      </p>
    </div>
  );
}
