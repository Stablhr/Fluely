'use client';

import {memo, useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {cn} from '@/lib/utils';
import {LOADING_FRAMES} from '@/lib/loadingFrames';
import {CURTAIN_FADE_OUT_MS} from '@/lib/auth/loadingCurtain';

/**
 * Full-screen loading curtain shown while a sign-in or sign-out request is in
 * flight, while a route segment is resolving (app/loading.tsx), and on the
 * first paint of a full page load. The mascot run-cycle is the twelve hand-drawn
 * frames in public/assets/Loading, laid on top of each other and crossfaded, and
 * the progress bar underneath is a separate CSS animation so it can run at its
 * own rhythm instead of being locked to the frame cycle.
 *
 * The curtain fades out on close, so the hand-off to the next page is not a hard
 * cut. `exiting` drives the fade; the provider owns the timer that unmounts us
 * once it has run. It does not fade *in* — see the note in the component body.
 *
 * Colors come from the brand tokens in app/kali.css — Ivory background, Drab
 * Dark Brown text, Poppins for the heading. Those tokens are declared in a global
 * `@theme` block rather than on `.kali-app`, so they also resolve when this
 * renders as a route fallback outside the app shell.
 */

/* How long one full pass of the cycle takes. 2.5s sits in the middle of the
   2-3s band; move this one number to retime the whole thing.

   The per-frame interval is derived from it rather than hand-tuned, because the
   two are the same decision: the frame list has twelve entries, so a longer
   cycle is unavoidably a lower frame rate. At 2.5s that is ~4.8fps, which is
   well below the ~10fps the frames were first tuned for and would read as
   steppy on its own — the crossfade below is what covers that, so raising this
   without also widening FRAME_FADE_RATIO reintroduces the slideshow. */
const CYCLE_MS = 2500;

const FRAME_INTERVAL_MS = CYCLE_MS / LOADING_FRAMES.length;

/* How much of each step is spent blending into the next pose. Swapping the src
   used to cut hard from one drawing to the next, which is what made every
   transition in the cycle read as a stutter. Fading over the first part of the
   step interpolates the pose instead of snapping to it.

   Just under half the step, so each frame still reaches full opacity for a
   moment and the cycle keeps reading as distinct poses rather than dissolving
   into one continuous blur. At the low frame rate CYCLE_MS implies, that
   half-step overlap is also what makes consecutive poses read as motion rather
   than as twelve separate drawings. */
const FRAME_FADE_MS = Math.round(FRAME_INTERVAL_MS * 0.45);

/* The source frames are square (362x362), so the stage is square too. A 3:2 box
   letterboxed the mascot down to 192px wide in a 288px row — a small drawing
   centred in a wide gap, which read as an alignment mistake. */
const MASCOT_SIZE_PX = 224;

const COPY = {
  login: 'Signing you in...',
  logout: 'Signing you out...',
  /* Route/navigation curtain, shown from app/loading.tsx while a segment
     resolves and on the first paint of a full page load. */
  load: 'Getting things ready...',
} as const;

export type LoadingScreenMode = keyof typeof COPY;

/**
 * Pull the frames into the browser cache, resolving once they have decoded.
 *
 * Called from the provider on app mount rather than from the component below:
 * starting the download when the curtain opens is too late, because frame one
 * would still be in flight and the mascot would pop in a beat after the
 * overlay. The frames render with `unoptimized`, so the URL cached here is the
 * same one that ends up in the img src.
 *
 * It never rejects: a frame that fails to load must not wedge the page behind a
 * full-screen overlay.
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
  /**
   * The page underneath is ready and the curtain is on its way out. The overlay
   * stays mounted and animates to `opacity-0`; the provider unmounts it once
   * CURTAIN_FADE_OUT_MS has elapsed. Unmounting on `false` alone would cut the
   * fade off mid-way.
   */
  exiting?: boolean;
};

/**
 * The mascot run-cycle, isolated from the rest of the curtain so a frame change
 * re-renders only the <img> tags — the progress bar and the label are static
 * and have no business repainting ten times a second.
 */
const MascotRun = memo(function MascotRun() {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Every frame sits in the DOM at once, so hold on the first pose until all of
     them have decoded. Fading into a bitmap that is still decoding puts an empty
     box on screen for a beat, which is its own kind of stutter. decode()
     resolves immediately for a cache hit, so on the common path this costs
     nothing. */
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
    /* Fixed box with every frame stacked absolutely inside it: all the PNGs
       share one square canvas, so holding them in the same place and moving only
       opacity keeps the mascot from shifting as the cycle advances. */
    <div
      ref={containerRef}
      className="relative shrink-0"
      style={{width: MASCOT_SIZE_PX, height: MASCOT_SIZE_PX}}
    >
      {LOADING_FRAMES.map((src, frame) => (
        <Image
          key={src}
          src={src}
          alt=""
          width={MASCOT_SIZE_PX}
          height={MASCOT_SIZE_PX}
          unoptimized
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            'transition-opacity',
            frame === index ? 'opacity-100 [will-change:opacity]' : 'opacity-0'
          )}
          style={{transitionDuration: `${FRAME_FADE_MS}ms`}}
        />
      ))}
    </div>
  );
});

export default function LoadingScreen({
  mode = 'login',
  exiting = false,
}: LoadingScreenProps) {
  /* No fade-in on mount. This component is also the Suspense fallback in
     app/loading.tsx, which means the overlay's first paint is baked into the
     server HTML — and any state that starts hidden (an opacity transition, or a
     CSS keyframe animation beginning at opacity 0) ships that first paint fully
     transparent. That is precisely the blank flash the curtain exists to cover,
     so it stays opaque from the first frame and only fades on the way out. The
     mascot's own crossfade keeps the screen in motion while it is up. */

  /* While fading out the label is describing a page that has already arrived, so
     the live region is taken out of the accessibility tree for the duration of
     the fade rather than being announced on top of the new page. */
  const announced = !exiting;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={announced}
      aria-hidden={announced ? undefined : true}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-7',
        'bg-brand-ivory/95 backdrop-blur-[2px] transition-opacity ease-out',
        /* A fully transparent overlay still covers the page and eats clicks, so
           it stops taking pointer events the moment it starts fading. */
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{transitionDuration: `${CURTAIN_FADE_OUT_MS}ms`}}
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
