'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight. The mascot run-cycle is four hand-drawn frames swapped on a timer
 * (option A from the brief: no framer-motion in this project), and the progress
 * bar underneath is a separate CSS animation so it can run at its own rhythm
 * instead of being locked to the frame cycle.
 *
 * Colors come from the brand tokens in app/kali.css — Ivory background, Drab
 * Dark Brown text, Poppins for the heading.
 */

/* Order matters: 1 mid-leap, 2 upright peak, 3 leaning run, 4 running. */
export const LOADING_FRAMES = [
  '/assets/Loading/fluely_loading_1.png',
  '/assets/Loading/fluely_loading_2.png',
  '/assets/Loading/fluely_loading_3.png',
  '/assets/Loading/fluely_loading_4.png',
] as const;

/* ~5.7fps reads as a run cycle; slower than this and it looks like a slideshow. */
const FRAME_INTERVAL_MS = 175;

const COPY = {
  login: 'Signing you in...',
  logout: 'Signing you out...',
} as const;

export type LoadingScreenMode = keyof typeof COPY;

/**
 * Pull the four frames into the browser cache.
 *
 * Called from the provider on app mount rather than from the component below:
 * starting the download when the curtain opens is too late, because frame one
 * would still be in flight and the mascot would pop in a beat after the
 * overlay. The frames render with `unoptimized`, so the URL cached here is the
 * same one that ends up in the img src.
 */
export function preloadLoadingFrames() {
  if (typeof window === 'undefined') return;

  for (const src of LOADING_FRAMES) {
    const image = new window.Image();
    image.src = src;
  }
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
