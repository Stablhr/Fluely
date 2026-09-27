'use client';

import {memo, useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {cn} from '@/lib/utils';
import {LOADING_FRAMES} from '@/lib/loadingFrames';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight, and on the first paint of any full page load. The mascot run-cycle is
 * four hand-drawn frames (option A from the brief: no framer-motion in this
 * project) laid on top of each other and crossfaded, and the progress bar
 * underneath is a separate CSS animation so it can run at its own rhythm
 * instead of being locked to the frame cycle.
 *
 * Colors come from the brand tokens in app/kali.css — Ivory background, Drab
 * Dark Brown text, Poppins for the heading.
 */

/* ~5.7fps reads as a run cycle; slower than this and it looks like a slideshow.
   The curtain itself is held on screen for a minimum of MIN_CURTAIN_MS
   (lib/auth/loadingCurtain.ts) so a fast response cannot reduce the whole thing
   to a single frame. */
const FRAME_INTERVAL_MS = 175;

/* How much of each step is spent blending into the next pose. Swapping the src
   used to cut hard from one drawing to the next, which is what made every
   transition in the cycle read as a stutter. Fading over the first part of the
   step interpolates the pose instead of snapping to it.

   Deliberately under half the step: each frame still sits fully opaque for a
   moment, so the cycle keeps reading as four distinct poses rather than
   dissolving into one continuous blur. */
const FRAME_FADE_MS = Math.round(FRAME_INTERVAL_MS * 0.45);

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

/**
 * The mascot run-cycle, isolated from the rest of the curtain so a frame change
 * re-renders four <img> tags and nothing else — the progress bar and the label
 * are static and have no business repainting four times a second.
 */
const MascotRun = memo(function MascotRun() {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* All four frames sit in the DOM at once now, so hold on the first pose until
     every one of them has decoded. Fading into a bitmap that is still decoding
     puts an empty box on screen for a beat, which is its own kind of stutter.
     decode() resolves immediately for a cache hit, so on the common path this
     costs nothing. */
  useEffect(() => {
    let cancelled = false;

    const decoded = Array.from(
      containerRef.current?.querySelectorAll('img') ?? [],
      (image) => image.decode().catch(() => undefined)
    );

    Promise.all(decoded).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    /* Driven off elapsed time on requestAnimationFrame rather than
       setInterval. A timer that lands in a busy frame is delivered late, so the
       old loop drifted and the gap between two poses was not always the same —
       which is the other half of why the cycle felt uneven. Advancing against
       the clock keeps every step exactly FRAME_INTERVAL_MS wide, and it means
       the incoming frame is on screen and already fading before it is due. */
    let raf = 0;
    let startedAt: number | null = null;
    let shown = 0;

    const tick = (now: number) => {
      if (startedAt === null) startedAt = now;
      const step = Math.floor((now - startedAt) / FRAME_INTERVAL_MS);
      if (step !== shown) {
        shown = step;
        setIndex(step % LOADING_FRAMES.length);
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [ready]);

  return (
    /* Fixed box with every frame stacked absolutely inside it: all four PNGs
       share one canvas size, so holding them in the same place and moving only
       opacity keeps the mascot from shifting as the cycle advances. */
    <div ref={containerRef} className="relative h-48 w-72">
      {LOADING_FRAMES.map((src, frame) => (
        <Image
          key={src}
          src={src}
          alt=""
          width={288}
          height={192}
          unoptimized
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            'transition-opacity [will-change:opacity]',
            frame === index ? 'opacity-100' : 'opacity-0'
          )}
          style={{transitionDuration: `${FRAME_FADE_MS}ms`}}
        />
      ))}
    </div>
  );
});

export default function LoadingScreen({mode = 'login'}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-brand-ivory/95 backdrop-blur-[2px]"
    >
      <MascotRun />

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
